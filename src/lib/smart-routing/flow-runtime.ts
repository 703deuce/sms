import "server-only";

import type { CompiledFlow, CompiledNode, SessionState } from "./types";
import {
  answerCall,
  gatherUsingAudio,
  gatherUsingSpeak,
  hangupCall,
  playbackOnCall,
  speakOnCall,
  startRecording,
  transferToPhone,
  type SmartRoutingClientState,
} from "./telnyx-provider";
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
import { getPrisma } from "@/lib/db";

function asCompiledFlow(raw: Record<string, unknown>): CompiledFlow {
  return raw as unknown as CompiledFlow;
}

function nextNodeId(node: CompiledNode, condition: string): string | null {
  return node.edges[condition] ?? node.edges[`digit:${condition}`] ?? null;
}

export async function executeNode(input: {
  sessionId: string;
  nodeId: string;
  eventContext?: { digit?: string; eventType?: string };
}) {
  const session = await loadCallSession(input.sessionId);
  if (!session || session.completedAt) return { done: true };

  const published = await loadPublishedCompiledFlow(session.flowId);
  if (!published) return { done: true, error: "no_published_flow" };

  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  const node = compiled.nodes[input.nodeId];
  if (!node) {
    await finalizeSession(input.sessionId, "routing_error");
    return { done: true, error: "missing_node" };
  }

  const state = (session.stateJson as SessionState) ?? {};
  const execution = await createNodeExecution({
    callSessionId: input.sessionId,
    nodeId: node.id,
    nodeType: node.type,
  });

  const clientBase: SmartRoutingClientState = {
    kind: "smart_routing",
    sessionId: input.sessionId,
    workspaceId: session.workspaceId,
    flowId: session.flowId,
    nodeId: node.id,
  };

  const controlId = session.callControlId ?? "";
  let nextId: string | null = null;

  try {
    switch (node.type) {
      case "ENTRY": {
        await answerCall(controlId, input.sessionId);
        nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
        break;
      }
      case "PLAY_PROMPT": {
        const text = String(node.config.text ?? node.config.promptText ?? "");
        const assetId = String(node.config.audioAssetId ?? "");
        const url = await resolveAudioUrlForAsset(session.workspaceId, assetId);
        if (url) {
          await playbackOnCall(controlId, url, clientBase, input.sessionId);
        } else if (text) {
          await speakOnCall(controlId, text, clientBase, input.sessionId);
        }
        nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
        break;
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
        const gatherState: SmartRoutingClientState = {
          ...clientBase,
          awaiting: "gather",
        };
        if (url) {
          await gatherUsingAudio({
            callControlId: controlId,
            audioUrl: url,
            validDigits,
            clientState: gatherState,
            sessionId: input.sessionId,
          });
        } else {
          await gatherUsingSpeak({
            callControlId: controlId,
            text: promptText,
            validDigits,
            clientState: gatherState,
            sessionId: input.sessionId,
          });
        }
        await updateSessionState(input.sessionId, {
          currentNodeId: node.id,
          stateJson: { ...state, awaitingEvent: "gather" },
        });
        await completeNodeExecution(execution.id, { awaiting: "gather" });
        return { done: false, awaiting: "gather" };
      }
      case "BUSINESS_HOURS": {
        const branch = await evaluateScheduleBranch(
          session.workspaceId,
          session.flow.timezone,
          session.flow.scheduleJson as Record<string, unknown>,
        );
        nextId = nextNodeId(node, branch) ?? nextNodeId(node, "closed");
        break;
      }
      case "TRANSFER_EXTERNAL": {
        const phone =
          String(node.config.phoneNumber ?? "").trim() ||
          await resolveDestinationPhone(session.workspaceId, String(node.config.destinationId ?? ""));
        if (!phone) {
          nextId = nextNodeId(node, "no_answer") ?? nextNodeId(node, "failed");
          break;
        }
        await emitSmartRoutingEvent({
          workspaceId: session.workspaceId,
          type: "TRANSFER_STARTED",
          sessionId: input.sessionId,
          flowId: session.flowId,
          payload: { to: phone },
        });
        await transferToPhone(controlId, phone, input.sessionId, {
          ...clientBase,
          awaiting: "transfer",
        });
        await updateSessionState(input.sessionId, {
          currentNodeId: node.id,
          stateJson: { ...state, awaitingEvent: "transfer" },
        });
        await completeNodeExecution(execution.id, { transferTo: phone });
        return { done: false, awaiting: "transfer" };
      }
      case "RING_GROUP": {
        const mode = String(node.config.mode ?? "sequential");
        const destinations = (node.config.destinations as string[]) ?? [];
        const idx = state.ringIndex ?? 0;
        const phone = destinations[idx]
          ? await resolveDestinationPhone(session.workspaceId, destinations[idx])
          : null;
        if (!phone) {
          nextId = nextNodeId(node, "no_answer");
          break;
        }
        await transferToPhone(controlId, phone, input.sessionId, clientBase);
        await updateSessionState(input.sessionId, {
          stateJson: {
            ...state,
            ringIndex: mode === "sequential" ? idx : idx,
            awaitingEvent: "transfer",
          },
        });
        await completeNodeExecution(execution.id, { ringIndex: idx, phone });
        return { done: false, awaiting: "transfer" };
      }
      case "VOICEMAIL": {
        const greeting = String(
          node.config.greeting ?? "Please leave a message after the tone.",
        );
        await speakOnCall(controlId, greeting, clientBase, input.sessionId);
        await startRecording(controlId, input.sessionId);
        await updateSessionState(input.sessionId, {
          stateJson: { ...state, awaitingEvent: "voicemail" },
        });
        await completeNodeExecution(execution.id, { recording: true });
        return { done: false, awaiting: "voicemail" };
      }
      case "SMS_CONSENT": {
        const digit = String(node.config.consentDigit ?? "1");
        const prompt = String(
          node.config.promptText ??
            "Sorry we missed your call. Press 1 and we'll text you now.",
        );
        await gatherUsingSpeak({
          callControlId: controlId,
          text: prompt,
          validDigits: digit,
          clientState: { ...clientBase, awaiting: "sms_consent" },
          sessionId: input.sessionId,
        });
        await updateSessionState(input.sessionId, {
          currentNodeId: node.id,
          stateJson: { ...state, awaitingEvent: "sms_consent" },
        });
        await completeNodeExecution(execution.id, { awaiting: "sms_consent" });
        return { done: false, awaiting: "sms_consent" };
      }
      case "PLAY_CONFIRMATION": {
        const text = String(
          node.config.text ?? "Perfect. Check your phone. We've just sent you a message.",
        );
        await speakOnCall(controlId, text, clientBase, input.sessionId);
        nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
        break;
      }
      case "SEND_SMS": {
        if (!session.isTest) {
          await recordSmsConsent({
            workspaceId: session.workspaceId,
            callerNumber: session.callerNumber,
            businessNumber: session.calledNumber,
            callSessionId: input.sessionId,
            affirmativeInput: "auto",
            consentScope: "CUSTOMER_CARE_SMS",
          });
          await triggerMissedCallTextFromConsent({
            workspaceId: session.workspaceId,
            callerNumber: session.callerNumber,
            businessNumber: session.calledNumber,
            callSessionId: input.sessionId,
          });
          await updateSessionState(input.sessionId, { smsTriggered: true });
        }
        nextId = nextNodeId(node, "always") ?? Object.values(node.edges)[0];
        break;
      }
      case "AI_RECEPTIONIST": {
        const agentId = String(node.config.aiAgentId ?? "");
        await emitSmartRoutingEvent({
          workspaceId: session.workspaceId,
          type: "AI_HANDOFF_STARTED",
          sessionId: input.sessionId,
          flowId: session.flowId,
          payload: {
            agentId,
            intentHint: node.config.intentHint,
            menuSelection: session.menuSelection,
          },
        });
        const { handleInboundCallEvent } = await import("@/lib/voice/inbound");
        const prisma = getPrisma();
        const pn = await prisma.phoneNumber.findFirst({
          where: { workspaceId: session.workspaceId, e164: session.calledNumber },
        });
        await handleInboundCallEvent({
          workspaceId: session.workspaceId,
          fromE164: session.callerNumber,
          toE164: session.calledNumber,
          telnyxCallControlId: controlId,
          payload: {
            smartRoutingSessionId: input.sessionId,
            intentHint: node.config.intentHint,
            menuSelection: session.menuSelection,
            agentId: agentId || undefined,
            phoneNumberId: pn?.id,
          },
        });
        await finalizeSession(input.sessionId, "ai_receptionist");
        await completeNodeExecution(execution.id, { handoff: "ai" });
        return { done: true, handoff: "ai" };
      }
      case "HANGUP": {
        await hangupCall(controlId, input.sessionId);
        await finalizeSession(input.sessionId, "caller_hung_up");
        await completeNodeExecution(execution.id, { hungup: true });
        return { done: true };
      }
      case "SUBFLOW": {
        const subflowId = String(node.config.subflowId ?? "");
        if (subflowId) {
          const sub = await loadPublishedCompiledFlow(subflowId);
          if (sub?.compiled) {
            const subCompiled = asCompiledFlow(sub.compiled as Record<string, unknown>);
            nextId = subCompiled.entryNodeId;
            await updateSessionState(input.sessionId, {
              stateJson: {
                ...state,
                subflowStack: [...(state.subflowStack ?? []), session.flowId],
              },
            });
          }
        }
        break;
      }
      default: {
        nextId = Object.values(node.edges)[0] ?? null;
      }
    }

    await completeNodeExecution(execution.id, { nextId });

    if (nextId) {
      await updateSessionState(input.sessionId, { currentNodeId: nextId });
      return executeNode({ sessionId: input.sessionId, nodeId: nextId });
    }

    await finalizeSession(input.sessionId, "completed");
    return { done: true };
  } catch (err) {
    await completeNodeExecution(
      execution.id,
      { error: String(err) },
      "failed",
    );
    const fallback = nextNodeId(node, "failed") ?? nextNodeId(node, "timeout");
    if (fallback) {
      return executeNode({ sessionId: input.sessionId, nodeId: fallback });
    }
    await finalizeSession(input.sessionId, "routing_error");
    return { done: true, error: String(err) };
  }
}

async function resolveDestinationPhone(workspaceId: string, destinationId: string) {
  if (!destinationId) return null;
  const prisma = getPrisma();
  const dest = await prisma.smartRoutingDestination.findFirst({
    where: { id: destinationId, workspaceId, active: true },
  });
  return dest?.phoneNumber?.trim() || null;
}

export async function finalizeSession(sessionId: string, outcome: string) {
  await updateSessionState(sessionId, {
    finalOutcome: outcome,
    completedAt: new Date(),
  });
  const session = await loadCallSession(sessionId);
  if (session) {
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: outcome.includes("error") || outcome.includes("failed") ? "FLOW_FAILED" : "FLOW_COMPLETED",
      sessionId,
      flowId: session.flowId,
      payload: { outcome },
    });
  }
}

export async function handleGatherResult(input: {
  sessionId: string;
  digit?: string;
  status?: string;
}) {
  const session = await loadCallSession(input.sessionId);
  if (!session?.currentNodeId) return { handled: false };

  const published = await loadPublishedCompiledFlow(session.flowId);
  if (!published) return { handled: false };
  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  const node = compiled.nodes[session.currentNodeId];
  if (!node) return { handled: false };

  const state = (session.stateJson as SessionState) ?? {};
  const digit = String(input.digit ?? "").trim();

  if (node.type === "SMS_CONSENT") {
    const consentDigit = String(node.config.consentDigit ?? "1");
    if (digit === consentDigit) {
      const { consent, duplicate } = await recordSmsConsent({
        workspaceId: session.workspaceId,
        callerNumber: session.callerNumber,
        businessNumber: session.calledNumber,
        callSessionId: input.sessionId,
        affirmativeInput: digit,
        promptAssetId: String(node.config.promptAssetId ?? ""),
      });
      if (!duplicate && !session.isTest) {
        await triggerMissedCallTextFromConsent({
          workspaceId: session.workspaceId,
          callerNumber: session.callerNumber,
          businessNumber: session.calledNumber,
          callSessionId: input.sessionId,
          isTest: session.isTest,
        });
        await updateSessionState(input.sessionId, { smsTriggered: true });
      }
      const nextId = nextNodeId(node, "digit") ?? nextNodeId(node, digit) ?? Object.values(node.edges)[0];
      if (nextId) {
        await emitSmartRoutingEvent({
          workspaceId: session.workspaceId,
          type: "MENU_SELECTION_RECEIVED",
          sessionId: input.sessionId,
          payload: { digit, kind: "sms_consent" },
        });
        return executeNode({ sessionId: input.sessionId, nodeId: nextId });
      }
    }
    const retries = (state.gatherRetries ?? 0) + 1;
    if (retries < 2) {
      await updateSessionState(input.sessionId, { stateJson: { ...state, gatherRetries: retries } });
      return executeNode({ sessionId: input.sessionId, nodeId: node.id });
    }
    const fallback = nextNodeId(node, "timeout") ?? nextNodeId(node, "invalid");
    if (fallback) return executeNode({ sessionId: input.sessionId, nodeId: fallback });
    return { handled: true };
  }

  if (digit) {
    await updateSessionState(input.sessionId, { menuSelection: digit });
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: "MENU_SELECTION_RECEIVED",
      sessionId: input.sessionId,
      payload: { digit },
    });
    const nextId =
      nextNodeId(node, `digit:${digit}`) ??
      nextNodeId(node, digit) ??
      nextNodeId(node, "invalid");
    if (nextId) return executeNode({ sessionId: input.sessionId, nodeId: nextId });
  }

  const retries = (state.gatherRetries ?? 0) + 1;
  if (!digit && retries < 2) {
    await updateSessionState(input.sessionId, { stateJson: { ...state, gatherRetries: retries } });
    return executeNode({ sessionId: input.sessionId, nodeId: node.id });
  }

  const timeoutNext = nextNodeId(node, "timeout");
  if (timeoutNext) return executeNode({ sessionId: input.sessionId, nodeId: timeoutNext });

  await finalizeSession(input.sessionId, "no_selection");
  return { handled: true, outcome: "no_selection" };
}

export async function handleTransferResult(input: {
  sessionId: string;
  answered?: boolean;
}) {
  const session = await loadCallSession(input.sessionId);
  if (!session?.currentNodeId) return { handled: false };

  const published = await loadPublishedCompiledFlow(session.flowId);
  if (!published) return { handled: false };
  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  const node = compiled.nodes[session.currentNodeId];
  if (!node) return { handled: false };

  if (input.answered) {
    await updateSessionState(input.sessionId, { answeredAt: new Date() });
    await emitSmartRoutingEvent({
      workspaceId: session.workspaceId,
      type: "TRANSFER_ANSWERED",
      sessionId: input.sessionId,
    });
    await finalizeSession(input.sessionId, "connected");
    return { handled: true, outcome: "connected" };
  }

  await emitSmartRoutingEvent({
    workspaceId: session.workspaceId,
    type: "TRANSFER_FAILED",
    sessionId: input.sessionId,
  });

  const state = (session.stateJson as SessionState) ?? {};
  const mode = String(node.config.mode ?? "");
  const destinations = (node.config.destinations as string[]) ?? [];
  if (node.type === "RING_GROUP" && mode === "sequential") {
    const nextIdx = (state.ringIndex ?? 0) + 1;
    if (nextIdx < destinations.length) {
      await updateSessionState(input.sessionId, {
        stateJson: { ...state, ringIndex: nextIdx },
      });
      return executeNode({ sessionId: input.sessionId, nodeId: node.id });
    }
  }

  const fallback = nextNodeId(node, "no_answer") ?? nextNodeId(node, "failed");
  if (fallback) return executeNode({ sessionId: input.sessionId, nodeId: fallback });

  await finalizeSession(input.sessionId, "transfer_failed");
  return { handled: true, outcome: "transfer_failed" };
}

export async function startFlowForInboundCall(input: {
  workspaceId: string;
  flowId: string;
  flowVersionId: string;
  callerNumber: string;
  calledNumber: string;
  callControlId: string;
  forwardedFrom?: string;
  isTest?: boolean;
}) {
  const { startCallSession } = await import("./session-store");
  const session = await startCallSession(input);
  const published = await loadPublishedCompiledFlow(input.flowId);
  if (!published?.compiled) throw new Error("No published flow");
  const compiled = asCompiledFlow(published.compiled as Record<string, unknown>);
  await executeNode({ sessionId: session.id, nodeId: compiled.entryNodeId });
  return session;
}
