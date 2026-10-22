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
} from "../conversation/delegation-timing";
import { noteSemanticTimingEvent } from "../telemetry/caller-turn-timing";
import { getCurrentConversationRevision } from "../conversation/conversation-revision";
import {
  buildSemanticSupersededToolResult,
  classifyVoiceToolFreshness,
  shouldBlockStaleToolPreDispatch,
} from "../delegation/conversation-freshness";
import type { VoiceToolResult } from "./types";
import { maybeExecuteDelegatedTransferCallResult } from "../transfer/execute-authorized-transfer-on-node";

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
  const delegationId = completed.delegationId ?? input.delegationId ?? null;
  const delegationRuntime = coordinator.getDelegationRuntime(delegationId);
  const currentConversationRevision = getCurrentConversationRevision(input.liveSessionId);
  const basedOnConversationRevision =
    delegationRuntime?.basedOnConversationRevision ?? currentConversationRevision;
  const delegationSemanticallyFresh = delegationRuntime?.semanticFreshness !== "STALE";

  if (!coordinator.registerPendingFunctionCall(completed)) {
    markSemanticInterpretationEnded(input.liveSessionId);
    return true;
  }

  executedCallIds.add(dedupeKey);

  const snap = runtime.getSnapshot();
  const rawArgs = completed.argumentsJson
    ? (JSON.parse(completed.argumentsJson) as unknown)
    : {};

  const workspaceId = runtime.config.workspaceId?.trim();
  if (!workspaceId) {
    console.error("VOICE_TOOL_MISSING_WORKSPACE_ID", {
      live_session_id: input.liveSessionId,
      call_id: snap.callId,
      tool_name: completed.name,
    });
  }

  let result: VoiceToolResult;
  const staleBlocked =
    isKnownTool &&
    shouldBlockStaleToolPreDispatch(
      completed.name,
      delegationSemanticallyFresh ? "FRESH" : "STALE",
    );

  const toolClass = classifyVoiceToolFreshness(completed.name);
  console.log("FRESHNESS_TOOL_AUTHORIZATION_DECISION", {
    live_session_id: input.liveSessionId,
    delegation_id: delegationId,
    function_call_id: completed.callId,
    tool_name: completed.name,
    tool_class: toolClass,
    based_on_conversation_revision: basedOnConversationRevision,
    current_conversation_revision: currentConversationRevision,
    semantic_freshness: delegationSemanticallyFresh ? "FRESH" : "STALE",
    dispatch_authorized: !staleBlocked,
  });

  if (staleBlocked) {
    console.log("STALE_TOOL_DISPATCH_BLOCKED", {
      live_session_id: input.liveSessionId,
      delegation_id: delegationId,
      tool_name: completed.name,
      call_id: completed.callId,
      based_on_conversation_revision: basedOnConversationRevision,
      current_conversation_revision: currentConversationRevision,
    });
    result = buildSemanticSupersededToolResult({
      toolName: completed.name,
      basedOnConversationRevision,
      currentConversationRevision,
      delegationId,
    });
  } else if (isKnownTool) {
    result = await executeVoiceTool(
      {
        callId: snap.callId,
        liveSessionId: input.liveSessionId,
        delegationId,
        functionCallId: completed.callId,
        runtime,
        tenantId: workspaceId || snap.callId,
        sendContext: input.send,
        delegationBasedOnConversationRevision: basedOnConversationRevision,
        currentConversationRevision,
        delegationSemanticallyFresh,
      },
      completed.name,
      rawArgs,
    );
    result = await maybeExecuteDelegatedTransferCallResult({
      toolName: completed.name,
      runtime,
      result,
    });
  } else {
    result = voiceToolError(
      "UNKNOWN_TOOL",
      `Tool ${completed.name} is not registered.`,
      { tool_name: completed.name },
    );
  }

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
