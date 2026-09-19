import { getVoiceV3CallRuntime } from "../state/call-runtime";
import { extractCompletedFunctionCallFromNested } from "../delegation/extract-completed-function-call";
import { getVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";
import { completeDelegatedFunctionCall } from "../delegation/complete-delegated-function-call";
import { executeVoiceTool } from "./execute-voice-tool";
import { isRegisteredVoiceTool } from "./registry";
import { voiceToolError } from "./types";
import {
  markSemanticInterpretationEnded,
  markSemanticInterpretationStarted,
} from "../conversation/semantic-turn-watchdog";
import { noteSemanticTimingEvent } from "../telemetry/caller-turn-timing";

const executedCallIds = new Set<string>();

function executionKey(liveSessionId: string, callId: string): string {
  return `${liveSessionId}:${callId}`;
}

export async function handleDelegatedVoiceToolCall(input: {
  liveSessionId: string;
  nested: Record<string, unknown>;
  send: (event: { type: string; [key: string]: unknown }) => void;
  delegationId?: string | null;
}): Promise<boolean> {
  const completed = extractCompletedFunctionCallFromNested(input.nested, input.delegationId);
  if (!completed) return false;

  const isKnownTool = isRegisteredVoiceTool(completed.name);

  console.log("ASTRA_FUNCTION_CALL_RECEIVED", {
    live_session_id: input.liveSessionId,
    tool: completed.name,
    call_id: completed.callId,
    delegation_id: completed.delegationId ?? input.delegationId ?? null,
    known_tool: isKnownTool,
  });

  const dedupeKey = executionKey(input.liveSessionId, completed.callId);
  if (executedCallIds.has(dedupeKey)) {
    console.log("VOICE_TOOL_DUPLICATE_IGNORED", {
      live_session_id: input.liveSessionId,
      call_id: completed.callId,
      tool_name: completed.name,
    });
    return true;
  }

  const runtime = getVoiceV3CallRuntime(input.liveSessionId);
  if (!runtime) return true;

  markSemanticInterpretationStarted(input.liveSessionId);
  noteSemanticTimingEvent(input.liveSessionId, "functionCallCompletedAt");

  const coordinator = getVoiceV3LiveResponseCoordinator(input.liveSessionId, input.send);
  if (!coordinator.registerPendingFunctionCall(completed)) {
    markSemanticInterpretationEnded(input.liveSessionId);
    return true;
  }

  executedCallIds.add(dedupeKey);

  const snap = runtime.getSnapshot();
  const rawArgs = completed.argumentsJson
    ? (JSON.parse(completed.argumentsJson) as unknown)
    : {};

  const result = isKnownTool
    ? await executeVoiceTool(
        {
          callId: snap.callId,
          liveSessionId: input.liveSessionId,
          delegationId: completed.delegationId ?? null,
          functionCallId: completed.callId,
          runtime,
          tenantId: snap.callId,
          sendContext: input.send,
        },
        completed.name,
        rawArgs,
      )
    : voiceToolError(
        "UNKNOWN_TOOL",
        `Tool ${completed.name} is not registered.`,
        { tool_name: completed.name },
      );

  const disposition = result.ok ? "APPLIED" : "DECODE_FAILED";
  completeDelegatedFunctionCall({
    coordinator,
    callId: completed.callId,
    delegationId: completed.delegationId ?? null,
    callerTurnId: null,
    semanticDisposition: disposition,
    output: result,
  });

  console.log("VOICE_TOOL_OUTPUT_SUBMITTED", {
    live_session_id: input.liveSessionId,
    function_call_id: completed.callId,
    tool_name: completed.name,
    ok: result.ok,
  });

  markSemanticInterpretationEnded(input.liveSessionId);
  return true;
}

export function clearDelegatedVoiceToolSessionState(liveSessionId: string): void {
  const prefix = `${liveSessionId.trim()}:`;
  for (const key of executedCallIds) {
    if (key.startsWith(prefix)) executedCallIds.delete(key);
  }
}
