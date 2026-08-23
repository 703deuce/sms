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
import {
  escapeXml,
  promptToTwimlInner,
  resolvePromptPlayback,
} from "./prompt-playback";
import { startTwilioWhisperTransfer } from "./twilio-whisper-service";
import { evaluateScheduleBranch } from "./schedule-engine";
import { recordSmsConsent, triggerMissedCallTextFromConsent } from "./consent-service";
import { emitSmartRoutingEvent } from "./events";
import { finalizeSession } from "./flow-runtime";
import { humanCallIdForSession } from "./human-call-bridge";
import {
  twilioVoicemailTranscriptionCallbackUrl,
} from "@/lib/phone/twilio-voicemail-pipeline";

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function twilioPersonalRecordingCallbackUrl(humanCallId: string, sessionId: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    humanCallId,
    srSessionId: sessionId,
  });
  return `${base}/api/webhooks/twilio/voice/recording?${params.toString()}`;
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

  const compiled: CompiledFlow = asCompiledFlow(published.compiled as Record<string, unknown>);
  let currentId: string | null = nodeId;
  const parts: string[] = [];

  while (currentId) {
    const node: CompiledNode | undefined = compiled.nodes[currentId];
    if (!node) break;
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
          const playback = await resolvePromptPlayback(session.workspaceId, node.config);
          const inner = promptToTwimlInner(playback);
          if (inner) parts.push(inner);
          nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
          await completeNodeExecution(execution.id, { nextId });
          currentId = nextId;
          continue;
        }
        case "MENU":
        case "GATHER_DTMF": {
          const playback = await resolvePromptPlayback(session.workspaceId, node.config);
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "gather",
          });
          const inner =
            promptToTwimlInner(playback) ||
            `<Say>${escapeXml("Please make a selection.")}</Say>`;
          parts.push(
            `<Gather numDigits="1" timeout="10" action="${escapeXml(action)}" method="POST">${inner}</Gather>`,
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
        case "TRANSFER_EXTERNAL": {
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
          const whisperText = String(node.config.whisperText ?? "").trim();
          const whisperEnabled =
            Boolean(node.config.whisperEnabled) || whisperText.length > 0;
          await emitSmartRoutingEvent({
            workspaceId: session.workspaceId,
            type: "TRANSFER_STARTED",
            sessionId,
            flowId: session.flowId,
            payload: { to: phone, whisper: whisperEnabled, provider: "twilio" },
          });
          if (whisperEnabled) {
            const whisper = await startTwilioWhisperTransfer({
              sessionId,
              workspaceId: session.workspaceId,
              flowId: session.flowId,
              nodeId: node.id,
              callerCallSid: session.callControlId ?? "",
              agentPhone: phone,
              fromNumber: session.calledNumber,
              whisperText:
                whisperText ||
                String(node.config.text ?? "Incoming business call. Press 1 to accept."),
              acceptDigit: String(node.config.acceptDigit ?? "1"),
            });
            await completeNodeExecution(execution.id, { whisperTo: phone });
            return { twiml: whisper.twiml, awaiting: "whisper" };
          }
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "transfer",
          });
          const ringSeconds =
            typeof node.config.ringSeconds === "number" ? node.config.ringSeconds : 25;
          parts.push(
            `<Dial callerId="${escapeXml(session.calledNumber)}" timeout="${ringSeconds}" action="${escapeXml(action)}" method="POST"><Number>${escapeXml(phone)}</Number></Dial>`,
          );
          await updateSessionState(sessionId, {
            currentNodeId: node.id,
            stateJson: { ...state, awaitingEvent: "transfer" },
          });
          await completeNodeExecution(execution.id, { transferTo: phone });
          return { twiml: twiml(parts.join("")), awaiting: "transfer" };
        }
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
          await emitSmartRoutingEvent({
            workspaceId: session.workspaceId,
            type: "TRANSFER_STARTED",
            sessionId,
            flowId: session.flowId,
            payload: { to: phone, whisper: true, provider: "twilio" },
          });
          const whisper = await startTwilioWhisperTransfer({
            sessionId,
            workspaceId: session.workspaceId,
            flowId: session.flowId,
            nodeId: node.id,
            callerCallSid: session.callControlId ?? "",
            agentPhone: phone,
            fromNumber: session.calledNumber,
            whisperText: String(
              node.config.whisperText ??
                node.config.text ??
                "Incoming business call. Press 1 to accept.",
            ),
            acceptDigit: String(node.config.acceptDigit ?? "1"),
          });
          await completeNodeExecution(execution.id, { whisperTo: phone });
          return { twiml: whisper.twiml, awaiting: "whisper" };
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
            .map((p) => `<Number>${escapeXml(p)}</Number>`)
            .join("");
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "transfer",
          });
          parts.push(
            `<Dial callerId="${escapeXml(session.calledNumber)}" timeout="25" action="${escapeXml(action)}" method="POST">${numbersXml}</Dial>`,
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
          const playback = await resolvePromptPlayback(session.workspaceId, {
            greeting: node.config.greeting,
            text: node.config.greeting,
          });
          const humanCallId = await humanCallIdForSession(sessionId);
          const preamble =
            promptToTwimlInner(playback) ||
            `<Say>${escapeXml("Please leave a message after the tone.")}</Say>`;
          parts.push(preamble);
          if (humanCallId) {
            const recordingCallback = twilioPersonalRecordingCallbackUrl(humanCallId, sessionId);
            const transcribeCallback = twilioVoicemailTranscriptionCallbackUrl(humanCallId);
            parts.push(
              `<Record maxLength="180" playBeep="true" transcribe="true" transcribeCallback="${escapeXml(transcribeCallback)}" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackMethod="POST"/>`,
            );
          } else {
            const action = smartRoutingCallbackUrl({
              sessionId,
              event: "recording",
            });
            parts.push(
              `<Record maxLength="180" playBeep="true" recordingStatusCallback="${escapeXml(action)}" recordingStatusCallbackMethod="POST"/>`,
            );
          }
          await updateSessionState(sessionId, {
            stateJson: { ...state, awaitingEvent: "voicemail" },
          });
          await completeNodeExecution(execution.id, { recording: true });
          return { twiml: twiml(parts.join("")), awaiting: "voicemail" };
        }
        case "SMS_CONSENT": {
          const { resolveSmsConsentPlayback, promptToTwimlInner, escapeXml } = await import(
            "./prompt-playback"
          );
          const playback = await resolveSmsConsentPlayback(session.workspaceId, node.config);
          if (playback.failClosed) {
            await finalizeSession(sessionId, "consent_playback_failed");
            return { twiml: twiml("<Hangup/>") };
          }
          const action = smartRoutingCallbackUrl({
            sessionId,
            event: "gather",
          });
          const inner =
            promptToTwimlInner(playback) ||
            `<Say>${escapeXml("Sorry we missed your call. Press 1 and we'll text you now.")}</Say>`;
          // Twilio Gather accepts DTMF during <Play> (barge-in) — Press 1 during or after prompt.
          parts.push(
            `<Gather numDigits="1" timeout="10" action="${escapeXml(action)}" method="POST">${inner}</Gather><Hangup/>`,
          );
          await updateSessionState(sessionId, {
            currentNodeId: node.id,
            stateJson: { ...state, awaitingEvent: "sms_consent" },
          });
          await completeNodeExecution(execution.id, { awaiting: "sms_consent" });
          return { twiml: twiml(parts.join("")), awaiting: "sms_consent" };
        }
        case "PLAY_CONFIRMATION": {
          const playback = await resolvePromptPlayback(session.workspaceId, node.config);
          const inner = promptToTwimlInner(playback);
          if (inner) parts.push(inner);
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
          const skipNext =
            nextNodeId(node, "no_answer") ??
            nextNodeId(node, "failed") ??
            Object.values(node.edges)[0];
          if (skipNext) {
            await completeNodeExecution(execution.id, {
              skipped: "ai_receptionist_not_launched",
              nextId: skipNext,
            });
            currentId = skipNext;
            continue;
          }
          parts.push("<Say>Thank you for calling. Goodbye.</Say><Hangup/>");
          await finalizeSession(sessionId, "completed");
          await completeNodeExecution(execution.id, { skipped: "ai_receptionist_not_launched" });
          return { twiml: twiml(parts.join("")) };
        }
        case "CALLBACK": {
          const promptText = String(
            node.config.promptText ?? "Thanks. We'll call you back as soon as we can.",
          );
          if (!session.isTest) {
            const { hasWorkspaceProductFeature } = await import(
              "@/lib/products/feature-entitlements"
            );
            const entitled = await hasWorkspaceProductFeature(
              session.workspaceId,
              "callback_requests",
            );
            if (entitled) {
              const { createCallbackRequest } = await import("@/lib/callback-requests/service");
              await createCallbackRequest({
                workspaceId: session.workspaceId,
                callerE164: session.callerNumber,
                businessE164: session.calledNumber,
                smartRoutingSessionId: sessionId,
                sourceRoute: String(node.config.label ?? "smart_routing"),
                reason: String(node.config.reason ?? "menu_callback"),
              });
            }
          }
          parts.push(`<Say>${promptText}</Say><Hangup/>`);
          await finalizeSession(sessionId, "callback_requested");
          await completeNodeExecution(execution.id, { callback: true });
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
  const { ensureSmartRoutingHumanCall } = await import("./human-call-bridge");
  await ensureSmartRoutingHumanCall({
    workspaceId: input.workspaceId,
    sessionId: session.id,
    fromE164: input.callerNumber,
    toE164: input.calledNumber,
    callSid: input.callSid,
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
        promptAssetId: String(node.config.promptAssetId ?? node.config.audioAssetId ?? ""),
        promptVersion: String(node.config.promptVersion ?? ""),
        metadata: {
          promptScriptHash: node.config.promptScriptHash ?? null,
          promptText: node.config.promptText ?? null,
        },
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

  if (recordingUrl) {
    await updateSessionState(sessionId, { recordingUrl });
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: "VOICEMAIL_RECEIVED",
      sessionId,
      payload: { url: recordingUrl },
    });
    await finalizeSession(sessionId, "voicemail");
  }
  return twiml("<Say>Thank you. Goodbye.</Say><Hangup/>");
}
