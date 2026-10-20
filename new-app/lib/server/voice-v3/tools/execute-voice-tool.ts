import { getVoiceTool } from "./registry";
import type { VoiceToolExecutionContext, VoiceToolResult } from "./types";
import { voiceToolError } from "./types";
import { isRetryableToolErrorCode } from "./tool-result-codes";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { getCurrentConversationRevision } from "../conversation/conversation-revision";

function safeValidationDetails(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object" && "message" in err) {
    return { message: String((err as { message: unknown }).message) };
  }
  return {};
}

function mapToolFailure(err: unknown): VoiceToolResult {
  console.error("VOICE_TOOL_EXECUTION_FAILED", { err });
  return voiceToolError(
    "TOOL_EXECUTION_FAILED",
    "The tool could not complete. Try again or gather more information from the caller.",
  );
}

export async function executeVoiceTool(
  ctx: VoiceToolExecutionContext,
  name: string,
  rawArgs: unknown,
): Promise<VoiceToolResult> {
  const currentConversationRevision =
    ctx.currentConversationRevision ?? getCurrentConversationRevision(ctx.liveSessionId);
  const executionCtx: VoiceToolExecutionContext = {
    ...ctx,
    currentConversationRevision,
    delegationBasedOnConversationRevision:
      ctx.delegationBasedOnConversationRevision ?? currentConversationRevision,
    delegationSemanticallyFresh: ctx.delegationSemanticallyFresh ?? true,
  };
  const started = Date.now();
  console.log("VOICE_TOOL_REQUESTED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    delegation_id: ctx.delegationId,
    function_call_id: ctx.functionCallId,
    tool_name: name,
  });

  const tool = getVoiceTool(name);
  if (!tool) {
    return voiceToolError("UNKNOWN_TOOL", `Unknown tool: ${name}`);
  }

  let args: unknown;
  try {
    args = tool.validate(rawArgs);
    console.log("VOICE_TOOL_VALIDATED", {
      call_id: ctx.callId,
      tool_name: name,
      function_call_id: ctx.functionCallId,
    });
  } catch (error) {
    logVoiceV3Pipeline("tools", "invalid_arguments", {
      call_id: ctx.callId,
      tool_name: name,
    });
    return voiceToolError(
      "INVALID_ARGUMENTS",
      "Tool arguments did not match the required schema.",
      safeValidationDetails(error),
    );
  }

  console.log("VOICE_TOOL_EXECUTION_STARTED", {
    call_id: ctx.callId,
    tool_name: name,
    function_call_id: ctx.functionCallId,
  });

  try {
    const result = await tool.execute(executionCtx, args);
    const finalized =
      result.ok || result.retryable != null
        ? result
        : { ...result, retryable: isRetryableToolErrorCode(result.code) };
    console.log(
      finalized.ok ? "VOICE_TOOL_EXECUTION_SUCCEEDED" : "VOICE_TOOL_EXECUTION_FAILED",
      {
        call_id: ctx.callId,
        tool_name: name,
        function_call_id: ctx.functionCallId,
        status: finalized.status,
        code: finalized.ok ? undefined : finalized.code,
        retryable: finalized.ok ? undefined : finalized.retryable,
        tool_validation_ms: Date.now() - started,
        tool_total_ms: Date.now() - started,
        elapsed_ms: Date.now() - started,
      },
    );
    return finalized;
  } catch (err) {
    return mapToolFailure(err);
  }
}
