import "server-only";

import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { getPrisma } from "@/lib/db";
import type { CompiledFlow, CompiledNode, SessionState } from "./types";
import {
  completeNodeExecution,
  createNodeExecution,
  loadCallSession,
  loadPublishedCompiledFlow,
  updateSessionState,
} from "./session-store";
import { resolveAudioUrlForAsset } from "./media-service";
import { evaluateScheduleBranch } from "./schedule-engine";
import { recordSmsConsent, triggerMissedCallTextFromConsent } from "./consent-service";
import { emitSmartRoutingEvent } from "./events";
import { finalizeSession } from "./flow-runtime";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function smartRoutingCallbackUrl(params: Record<string, string>): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  const qs = new URLSearchParams(params).toString();
  return `${base}/api/webhooks/twilio/voice/smart-routing?${qs}`;
}

function asCompiledFlow(raw: Record<string, unknown>): CompiledFlow {
  return raw as unknown as CompiledFlow;
}

function nextNodeId(node: CompiledNode, condition: string): string | null {
  return node.edges[condition] ?? node.edges[`digit:${condition}`] ?? null;
}

async function resolveDestinationPhone(workspaceId: string, destinationId: string) {
  if (!destinationId) return null;
  const prisma = getPrisma();
  const dest = await prisma.smartRoutingDestination.findFirst({
    where: { id: destinationId, workspaceId, active: true },
  });
  return dest?.phoneNumber?.trim() || null;
}

type TwimlBuild = { twiml: string; awaiting?: string };

export async function buildTwimlForNode(sessionId: string, nodeId: string): Promise<TwimlBuild> {
  const session = await loadCallSession(sessionId);
  if (!session || session.completedAt) {
    return { twiml: twiml("<Hangup/>") };
  }

  const published = await loadPublishedCompiledFlow(session.flowId);
  if (!published) {
    return { twiml: twiml("<Say>Routing error.</Say><Hangup/>") };
  }

  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  let currentId: string | null = nodeId;
  const parts: string[] = [];

  while (currentId && compiled.nodes[currentId]) {
    const node = compiled.nodes[currentId];
    const state = (session.stateJson as SessionState) ?? {};
    const execution = await createNodeExecution({
      callSessionId: sessionId,
      nodeId: node.id,
      nodeType: node.type,
    });

    let nextId: string | null = null;

    try {
      switch (node.type) {
        case "ENTRY": {
          nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
        case "PLAY_PROMPT": {
          const text = String(node.config.text ?? node.config.promptText ?? "");
          const assetId = String(node.config.audioAssetId ?? "");
          const url = await resolveAudioUrlForAsset(session.workspaceId, assetId);
          if (url) {
            parts.push(`<Play>${xmlEscape(url)}</Play>`);
          } else if (text) {
            parts.push(`<Say>${xmlEscape(text)}</Say>`);
          }
          nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
        case "MENU":
        case "GATHER_DTMF": {
          const promptText = String(
            node.config.promptText ?? node.config.text ?? "Please make a selection.",
          );
          const menuOpts = (node.config.menuOptions as Array<{ digit: string }>) ?? [];
          const validDigits =
            menuOpts.map((o) => o.digit).join("") ||
            String(node.config.validDigits ?? "0123456789*#");
          const assetId = String(node.config.audioAssetId ?? "");
          const url = await resolveAudioUrlForAsset(session.workspaceId, assetId);
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "gather",
          });
          let inner = "";
          if (url) {
            inner = `<Play>${xmlEscape(url)}</Play>`;
          } else {
            inner = `<Say>${xmlEscape(promptText)}</Say>`;
          }
          parts.push(
            `<Gather numDigits="1" timeout="10" action="${xmlEscape(action)}" method="POST">${inner}</Gather>`,
          );
          parts.push("<Say>We did not receive your selection.</Say><Hangup/>");
          await updateSessionState(sessionId, {
            currentNodeId: node.id,
            stateJson: { ...state, awaitingEvent: "gather" },
          });
          await completeNodeExecution(execution.id, { awaiting: "gather" });
          return { twiml: twiml(parts.join("")), awaiting: "gather" };
        }
        case "BUSINESS_HOURS": {
          const branch = await evaluateScheduleBranch(
            session.workspaceId,
            session.flow.timezone,
            session.flow.scheduleJson as Record<string, unknown>,
          );
          nextId = nextNodeId(node, branch) ?? nextNodeId(node, "closed");
          await completeNodeExecution(execution.id, { branch, nextId });
          currentId = nextId;
          continue;
        }
        case "TRANSFER_EXTERNAL":
        case "CALL_WHISPER": {
          const phone =
            String(node.config.phoneNumber ?? "").trim() ||
            await resolveDestinationPhone(
              session.workspaceId,
              String(node.config.destinationId ?? ""),
            );
          if (!phone) {
            nextId = nextNodeId(node, "no_answer") ?? nextNodeId(node, "failed");
            await completeNodeExecution(execution.id, { nextId, error: "no_phone" });
            currentId = nextId;
            continue;
          }
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "transfer",
          });
          const ringSeconds =
            typeof node.config.ringSeconds === "number" ? node.config.ringSeconds : 25;
          parts.push(
            `<Dial callerId="${xmlEscape(session.calledNumber)}" timeout="${ringSeconds}" action="${xmlEscape(action)}" method="POST"><Number>${xmlEscape(phone)}</Number></Dial>`,
          );
          await updateSessionState(sessionId, {
            currentNodeId: node.id,
            stateJson: { ...state, awaitingEvent: "transfer" },
          });
          await completeNodeExecution(execution.id, { transferTo: phone });
          await emitSmartRoutingEvent({
            workspaceId: session.workspaceId,
            type: "TRANSFER_STARTED",
            sessionId,
            flowId: session.flowId,
            payload: { to: phone, provider: "twilio" },
          });
          return { twiml: twiml(parts.join("")), awaiting: "transfer" };
        }
        case "RING_GROUP": {
          const mode = String(node.config.mode ?? "sequential");
          const phoneList = ((node.config.phoneNumbers as string[]) ?? []).filter(Boolean);
          const destIds = (node.config.destinations as string[]) ?? [];
          const phones =
            phoneList.length > 0
              ? phoneList
              : (
                  await Promise.all(
                    destIds.map((id) => resolveDestinationPhone(session.workspaceId, id)),
                  )
                ).filter((p): p is string => Boolean(p));
          if (!phones.length) {
            nextId = nextNodeId(node, "no_answer");
            await completeNodeExecution(execution.id, { nextId });
            currentId = nextId;
            continue;
          }
          const ringIndex = state.ringIndex ?? 0;
          const dialTargets =
            mode === "simultaneous" ? phones : [phones[ringIndex] ?? phones[0]];
          const numbersXml = dialTargets
            .map((p) => `<Number>${xmlEscape(p)}</Number>`)
            .join("");
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "transfer",
          });
          parts.push(
            `<Dial callerId="${xmlEscape(session.calledNumber)}" timeout="25" action="${xmlEscape(action)}" method="POST">${numbersXml}</Dial>`,
          );
          await updateSessionState(sessionId, {
            currentNodeId: node.id,
            stateJson: {
              ...state,
              awaitingEvent: "ring_group",
              ringPhones: phones,
              ringIndex,
            },
          });
          await completeNodeExecution(execution.id, { ring: dialTargets });
          return { twiml: twiml(parts.join("")), awaiting: "ring_group" };
        }
        case "VOICEMAIL": {
          const greeting = String(
            node.config.greeting ?? "Please leave a message after the tone.",
          );
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "recording",
          });
          parts.push(`<Say>${xmlEscape(greeting)}</Say>`);
          parts.push(
            `<Record maxLength="180" playBeep="true" recordingStatusCallback="${xmlEscape(action)}" recordingStatusCallbackMethod="POST"/>`,
          );
          await updateSessionState(sessionId, {
            stateJson: { ...state, awaitingEvent: "voicemail" },
          });
          await completeNodeExecution(execution.id, { recording: true });
          return { twiml: twiml(parts.join("")), awaiting: "voicemail" };
        }
        case "SMS_CONSENT": {
          const digit = String(node.config.consentDigit ?? "1");
          const prompt = String(
            node.config.promptText ??
              "Sorry we missed your call. Press 1 and we'll text you now.",
          );
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "gather",
          });
          parts.push(
            `<Gather numDigits="1" timeout="10" action="${xmlEscape(action)}" method="POST"><Say>${xmlEscape(prompt)}</Say></Gather><Hangup/>`,
          );
          await updateSessionState(sessionId, {
            currentNodeId: node.id,
            stateJson: { ...state, awaitingEvent: "sms_consent" },
          });
          await completeNodeExecution(execution.id, { awaiting: "sms_consent" });
          return { twiml: twiml(parts.join("")), awaiting: "sms_consent" };
        }
        case "PLAY_CONFIRMATION": {
          const text = String(
            node.config.text ?? "Perfect. Check your phone. We've just sent you a message.",
          );
          parts.push(`<Say>${xmlEscape(text)}</Say>`);
          nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
        case "SEND_SMS": {
          if (!session.isTest) {
            await recordSmsConsent({
              workspaceId: session.workspaceId,
              callerNumber: session.callerNumber,
              businessNumber: session.calledNumber,
              callSessionId: sessionId,
              affirmativeInput: "auto",
              consentScope: "CUSTOMER_CARE_SMS",
            });
            await triggerMissedCallTextFromConsent({
              workspaceId: session.workspaceId,
              callerNumber: session.callerNumber,
              businessNumber: session.calledNumber,
              callSessionId: sessionId,
            });
            await updateSessionState(sessionId, { smsTriggered: true });
          }
          nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
        case "AI_RECEPTIONIST": {
          await emitSmartRoutingEvent({
            workspaceId: session.workspaceId,
            type: "AI_HANDOFF_STARTED",
            sessionId,
            flowId: session.flowId,
            payload: { provider: "twilio", note: "twilio_ai_handoff_pending" },
          });
          await finalizeSession(sessionId, "ai_receptionist_unavailable");
          await completeNodeExecution(execution.id, { handoff: "twilio_deferred" });
          parts.push(
            "<Say>Please call back during business hours or leave a message after the tone.</Say><Hangup/>",
          );
          return { twiml: twiml(parts.join("")) };
        }
        case "HANGUP": {
          parts.push("<Hangup/>");
          await finalizeSession(sessionId, "caller_hung_up");
          await completeNodeExecution(execution.id, { hungup: true });
          return { twiml: twiml(parts.join("")) };
        }
        case "SUBFLOW": {
          const subflowId = String(node.config.subflowId ?? "");
          if (subflowId) {
            const sub = await loadPublishedCompiledFlow(subflowId);
            if (sub?.compiled) {
              const subCompiled = asCompiledFlow(sub.compiled as Record<string, unknown>);
              nextId = subCompiled.entryNodeId;
              await updateSessionState(sessionId, {
                stateJson: {
                  ...state,
                  subflowStack: [...(state.subflowStack ?? []), session.flowId],
                },
              });
            }
          }
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
        default: {
          nextId = Object.values(node.edges)[0] ?? null;
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
      }
    } catch (err) {
      await completeNodeExecution(execution.id, { error: String(err) }, "failed");
      const fallback = nextNodeId(node, "failed") ?? nextNodeId(node, "timeout");
      if (fallback) {
        currentId = fallback;
        continue;
      }
      await finalizeSession(sessionId, "routing_error");
      return { twiml: twiml("<Say>Routing error.</Say><Hangup/>") };
    }
  }

  await finalizeSession(sessionId, "completed");
  return { twiml: twiml(parts.join("") || "<Hangup/>") };
}

export async function startTwilioFlowForInbound(input: {
  workspaceId: string;
  flowId: string;
  flowVersionId: string;
  callerNumber: string;
  calledNumber: string;
  callSid: string;
  forwardedFrom?: string;
  isTest?: boolean;
}) {
  const { startCallSession } = await import("./session-store");
  const session = await startCallSession({
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    flowVersionId: input.flowVersionId,
    callerNumber: input.callerNumber,
    calledNumber: input.calledNumber,
    callControlId: input.callSid,
    forwardedFrom: input.forwardedFrom,
    isTest: input.isTest,
    provider: "twilio",
  });
  const published = await loadPublishedCompiledFlow(input.flowId);
  if (!published?.compiled) throw new Error("No published flow");
  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  const built = await buildTwimlForNode(session.id, compiled.entryNodeId);
  return { session, twiml: built.twiml };
}

export async function handleTwilioGatherCallback(sessionId: string, digit: string) {
  const session = await loadCallSession(sessionId);
  if (!session?.currentNodeId) return twiml("<Hangup/>");

  const published = await loadPublishedCompiledFlow(session.flowId);
  if (!published) return twiml("<Hangup/>");
  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  const node = compiled.nodes[session.currentNodeId];
  if (!node) return twiml("<Hangup/>");

  const state = (session.stateJson as SessionState) ?? {};
  const d = digit.trim();

  if (node.type === "SMS_CONSENT") {
    const consentDigit = String(node.config.consentDigit ?? "1");
    if (d === consentDigit) {
      const { consent, duplicate } = await recordSmsConsent({
        workspaceId: session.workspaceId,
        callerNumber: session.callerNumber,
        businessNumber: session.calledNumber,
        callSessionId: sessionId,
        affirmativeInput: d,
        promptAssetId: String(node.config.promptAssetId ?? ""),
      });
      if (!duplicate && !session.isTest) {
        await triggerMissedCallTextFromConsent({
          workspaceId: session.workspaceId,
          callerNumber: session.callerNumber,
          businessNumber: session.calledNumber,
          callSessionId: sessionId,
          isTest: session.isTest,
        });
        await updateSessionState(sessionId, { smsTriggered: true });
      }
      const nextId =
        nextNodeId(node, "digit") ?? nextNodeId(node, d) ?? Object.values(node.edges)[0];
      if (nextId) {
        const built = await buildTwimlForNode(sessionId, nextId);
        return built.twiml;
      }
    }
    const retries = (state.gatherRetries ?? 0) + 1;
    if (retries < 2) {
      await updateSessionState(sessionId, { stateJson: { ...state, gatherRetries: retries } });
      return (await buildTwimlForNode(sessionId, node.id)).twiml;
    }
    const fallback = nextNodeId(node, "timeout") ?? nextNodeId(node, "invalid");
    if (fallback) return (await buildTwimlForNode(sessionId, fallback)).twiml;
    await finalizeSession(sessionId, "no_selection");
    return twiml("<Hangup/>");
  }

  if (d) {
    await updateSessionState(sessionId, { menuSelection: d });
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: "MENU_SELECTION_RECEIVED",
      sessionId,
      payload: { digit: d },
    });
    const nextId =
      nextNodeId(node, `digit:${d}`) ?? nextNodeId(node, d) ?? nextNodeId(node, "invalid");
    if (nextId) return (await buildTwimlForNode(sessionId, nextId)).twiml;
  }

  const retries = (state.gatherRetries ?? 0) + 1;
  if (!d && retries < 2) {
    await updateSessionState(sessionId, { stateJson: { ...state, gatherRetries: retries } });
    return (await buildTwimlForNode(sessionId, node.id)).twiml;
  }

  const timeoutNext = nextNodeId(node, "timeout");
  if (timeoutNext) return (await buildTwimlForNode(sessionId, timeoutNext)).twiml;

  await finalizeSession(sessionId, "no_selection");
  return twiml("<Hangup/>");
}

export async function handleTwilioTransferCallback(
  sessionId: string,
  dialCallStatus: string,
) {
  const session = await loadCallSession(sessionId);
  if (!session?.currentNodeId) return twiml("<Hangup/>");

  const published = await loadPublishedCompiledFlow(session.flowId);
  if (!published) return twiml("<Hangup/>");
  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  const node = compiled.nodes[session.currentNodeId];
  if (!node) return twiml("<Hangup/>");

  const answered =
    dialCallStatus === "completed" || dialCallStatus === "answered" || dialCallStatus === "in-progress";

  if (answered) {
    await updateSessionState(sessionId, { answeredAt: new Date() });
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: "TRANSFER_ANSWERED",
      sessionId,
    });
    await finalizeSession(sessionId, "connected");
    return twiml("");
  }

  await emitSmartRoutingEvent({
    workspaceId: session.workspaceId,
    type: "TRANSFER_FAILED",
    sessionId,
  });

  const state = (session.stateJson as SessionState) ?? {};
  if (node.type === "RING_GROUP" && String(node.config.mode ?? "") === "sequential") {
    const phones = state.ringPhones ?? [];
    const nextIdx = (state.ringIndex ?? 0) + 1;
    if (nextIdx < phones.length) {
      await updateSessionState(sessionId, {
        stateJson: { ...state, ringIndex: nextIdx },
      });
      return (await buildTwimlForNode(sessionId, node.id)).twiml;
    }
  }

  const fallback = nextNodeId(node, "no_answer") ?? nextNodeId(node, "failed");
  if (fallback) return (await buildTwimlForNode(sessionId, fallback)).twiml;

  await finalizeSession(sessionId, "transfer_failed");
  return twiml("<Hangup/>");
}

export async function handleTwilioRecordingCallback(sessionId: string, recordingUrl: string) {
  const session = await loadCallSession(sessionId);
  if (!session) return twiml("<Hangup/>");

  const prisma = getPrisma();
  if (recordingUrl) {
    await prisma.smartRoutingCallSession.update({
      where: { id: sessionId },
      data: {
        recordingUrl,
        finalOutcome: "voicemail",
        completedAt: new Date(),
      },
    });
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: "VOICEMAIL_RECEIVED",
      sessionId,
      payload: { url: recordingUrl },
    });
  }
  return twiml("<Say>Thank you. Goodbye.</Say><Hangup/>");
}
