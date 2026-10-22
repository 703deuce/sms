import "server-only";

import { getPrisma } from "@/lib/server/db";
import type { LiveSessionRuntime } from "@/lib/server/receptionist/runtime/session-store";
import { getVoiceV3CallRuntime } from "@/lib/server/voice-v3/state/call-runtime";
import { executeVoiceTool } from "@/lib/server/voice-v3/tools/execute-voice-tool";
import type { ToolResult } from "@/lib/server/voice-v3/tool-result";
import {
  attachLiveContextEventsToToolResult,
  createVoiceV3LiveKitLiveContextCollector,
} from "@/lib/server/voice-v3/livekit/live-context";
import { getCurrentConversationRevision } from "@/lib/server/voice-v3/conversation/conversation-revision";
import { maybeExecuteDelegatedTransferCallResult } from "@/lib/server/voice-v3/transfer/execute-authorized-transfer-on-node";

function mapEngineResult(result: {
  ok: boolean;
  status: string;
  code?: string;
  message?: string;
  data?: Record<string, unknown>;
  details?: Record<string, unknown>;
  retryable?: boolean;
  liveContextEvents?: unknown;
}): ToolResult {
  if (result.ok) {
    const liveContextEvents = (result as { liveContextEvents?: unknown }).liveContextEvents;
    const payload = result.data ?? {};
    return {
      ok: true,
      status: result.status,
      ...payload,
      ...(typeof payload === "object" && payload !== null && Object.keys(payload).length > 0
        ? { data: payload }
        : {}),
      ...(Array.isArray(liveContextEvents) && liveContextEvents.length > 0
        ? { liveContextEvents }
        : {}),
    };
  }
  return {
    ok: false,
    status: result.status,
    code: result.code || "TOOL_ERROR",
    message: result.message || "Tool failed",
    details: result.details,
    retryable: result.retryable,
  };
}

export async function executeNativeVoiceV3Tool(input: {
  session: LiveSessionRuntime;
  toolName: string;
  args: Record<string, unknown>;
  functionCallId: string;
  delegationId?: string | null;
}): Promise<ToolResult> {
  const runtime = getVoiceV3CallRuntime(input.session.liveSessionId);
  if (!runtime) {
    return {
      ok: false,
      status: "error",
      code: "RUNTIME_NOT_FOUND",
      message: "Voice V3 call runtime not found for session",
    };
  }

  const prisma = getPrisma();
  if (!input.session.processedToolCalls) input.session.processedToolCalls = new Set();
  if (input.session.processedToolCalls.has(input.functionCallId)) {
    const prior = await prisma.voiceToolExecution.findFirst({
      where: { callId: input.session.callId },
      orderBy: { completedAt: "desc" },
    });
    if (prior?.output && typeof prior.output === "object") {
      return prior.output as ToolResult;
    }
  }
  input.session.processedToolCalls.add(input.functionCallId);

  const liveContext = createVoiceV3LiveKitLiveContextCollector();
  const currentRevision = getCurrentConversationRevision(input.session.liveSessionId);

  try {
    let engineResult = await executeVoiceTool(
      {
        callId: runtime.getSnapshot().callId,
        liveSessionId: input.session.liveSessionId,
        delegationId: input.delegationId?.trim() || null,
        functionCallId: input.functionCallId,
        runtime,
        tenantId: input.session.workspaceId,
        sendContext: liveContext.sendContext,
        currentConversationRevision: currentRevision,
        delegationBasedOnConversationRevision: currentRevision,
        delegationSemanticallyFresh: true,
      },
      input.toolName,
      input.args,
    );

    if (input.toolName === "transfer_call") {
      engineResult = await maybeExecuteDelegatedTransferCallResult({
        toolName: input.toolName,
        runtime,
        result: engineResult,
      });
    }

    const withLive = attachLiveContextEventsToToolResult(
      engineResult as Record<string, unknown>,
      liveContext.events,
    );
    const result = mapEngineResult(withLive as typeof engineResult);

    await prisma.voiceToolExecution.create({
      data: {
        workspaceId: input.session.workspaceId,
        callId: input.session.callId,
        status: result.ok ? "success" : "failed",
        input: {
          toolName: input.toolName,
          arguments: input.args,
          functionCallId: input.functionCallId,
        },
        output: result as object,
        errorMessage: result.ok ? null : result.message,
        latencyMs: 0,
        completedAt: new Date(),
      },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: ToolResult = {
      ok: false,
      status: "error",
      code: "TOOL_EXECUTION_FAILED",
      message,
      retryable: true,
    };
    await prisma.voiceToolExecution.create({
      data: {
        workspaceId: input.session.workspaceId,
        callId: input.session.callId,
        status: "failed",
        input: {
          toolName: input.toolName,
          arguments: input.args,
          functionCallId: input.functionCallId,
        },
        errorMessage: message,
        latencyMs: 0,
        completedAt: new Date(),
      },
    });
    return result;
  }
}
