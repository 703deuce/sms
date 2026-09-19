import { getVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";
import { logVoiceV3Pipeline, summarizeAstraNestedEvent } from "../telemetry/pipeline-log";
import { VoiceV3CallTrace } from "../telemetry/call-trace";
import { clearDelegatedAstraResponseDedup } from "./delegated-response-dedup";
import { clearCallerTurnBuffer } from "./caller-turn-buffer";
import { clearGreetingTurnState } from "../greeting/greeting-turn";
import { clearVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";
import {
  clearCallerTurnManager,
} from "../conversation/caller-turn-manager";
import { clearCallerTurnSemanticProgress } from "../conversation/caller-turn-semantic-progress";
import { clearSemanticTurnWatchdog } from "../conversation/semantic-turn-watchdog";
import { clearLiveSpeakSync } from "../agent/live-speak-sync";
import {
  clearDelegatedVoiceToolSessionState,
  handleDelegatedVoiceToolCall,
} from "../tools/handle-delegated-voice-tools";
import {
  markSemanticInterpretationEnded,
} from "../conversation/semantic-turn-watchdog";
import { drainQueuedSemanticTurns } from "../conversation/semantic-turn-watchdog";
import { getCallerEvidenceTurnId } from "./caller-evidence";
import {
  noteTurnDelegationContinued,
  noteTurnDelegationObserved,
} from "../conversation/caller-turn-semantic-progress";
import { noteSemanticTimingEvent } from "../telemetry/caller-turn-timing";

const delegationStartedSessions = new Set<string>();

/**
 * Nested Astra / delegated Responses events — tool execution + protocol only.
 * No CallerMeaning, planner, or application conversational response.create.
 */
export function handleDelegatedAstraResponseEvent(input: {
  liveSessionId: string;
  nested: Record<string, unknown>;
  send: (event: { type: string; [key: string]: unknown }) => void;
  delegationId?: string | null;
}): void {
  const nestedType = String(input.nested.type || "");
  const sessionId = input.liveSessionId;

  getVoiceV3LiveResponseCoordinator(sessionId, input.send).onDelegatedNestedResponseEvent(
    input.delegationId,
    input.nested,
  );

  if (nestedType === "response.completed") {
    drainQueuedSemanticTurns({ liveSessionId: sessionId, send: input.send });
    const turnId = getCallerEvidenceTurnId(sessionId);
    if (turnId) {
      noteTurnDelegationContinued(sessionId, turnId);
    }
    if (!getVoiceV3LiveResponseCoordinator(sessionId, input.send).hasPendingFunctionOutputs()) {
      markSemanticInterpretationEnded(sessionId);
    }
    delegationStartedSessions.delete(sessionId);
    return;
  }

  if (nestedType === "response.created" || nestedType === "response.in_progress") {
    const turnId = getCallerEvidenceTurnId(sessionId);
    noteSemanticTimingEvent(sessionId, "astraFirstOutputAt", turnId);
    if (turnId) {
      noteTurnDelegationObserved(sessionId, turnId, input.delegationId ?? null);
    }
    if (!delegationStartedSessions.has(sessionId)) {
      delegationStartedSessions.add(sessionId);
      console.log("ASTRA_DELEGATION_STREAMING", {
        live_session_id: sessionId,
        response_type: nestedType,
      });
    }
    return;
  }

  if (nestedType === "response.failed") {
    VoiceV3CallTrace.peek(sessionId)?.onMeaningFailed();
    logVoiceV3Pipeline("delegation", "response.failed", {
      live_session_id: sessionId,
      nested: input.nested,
    });
    delegationStartedSessions.delete(sessionId);
    return;
  }

  if (nestedType === "response.function_call_arguments.done") {
    return;
  }

  if (nestedType === "response.output_item.done") {
    const item = input.nested.item;
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (row.type === "function_call") {
        queueMicrotask(() => {
          void handleDelegatedVoiceToolCall({
            liveSessionId: sessionId,
            nested: input.nested,
            send: input.send,
            delegationId: input.delegationId,
          }).finally(() => {
            delegationStartedSessions.delete(sessionId);
          });
        });
      }
    }
    return;
  }

  if (nestedType === "response.output_text.done") {
    logVoiceV3Pipeline("delegation", "output_text.done_ignored", {
      live_session_id: sessionId,
      ...summarizeAstraNestedEvent(input.nested),
    });
  }
}

export function clearDelegatedMeaningSessionState(liveSessionId: string): void {
  delegationStartedSessions.delete(liveSessionId);
  clearDelegatedAstraResponseDedup(liveSessionId);
  clearCallerTurnBuffer(liveSessionId);
  clearCallerTurnManager(liveSessionId);
  clearSemanticTurnWatchdog(liveSessionId);
  clearCallerTurnSemanticProgress(liveSessionId);
  clearLiveSpeakSync(liveSessionId);
  clearGreetingTurnState(liveSessionId);
  clearVoiceV3LiveResponseCoordinator(liveSessionId);
  clearDelegatedVoiceToolSessionState(liveSessionId);
}
