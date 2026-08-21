import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

const METRICS_KEY = "livekitCallMetrics";

async function persistToolExecution(input: {
  workspaceId: string;
  callId: string;
  toolType: string;
  toolArgs?: Record<string, unknown>;
  toolStatus: "completed" | "failed";
  toolOutput?: unknown;
  toolError?: string;
  latencyMs?: number;
}): Promise<void> {
  const prisma = getPrisma();
  try {
    const execution = await prisma.voiceToolExecution.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        toolId: null,
        status: input.toolStatus,
        input: { toolType: input.toolType, ...(input.toolArgs || {}) } as Prisma.InputJsonValue,
        output:
          input.toolStatus === "completed" && input.toolOutput !== undefined
            ? (input.toolOutput as Prisma.InputJsonValue)
            : undefined,
        errorMessage: input.toolError,
        latencyMs: input.latencyMs ?? 0,
        isAsync: false,
        completedAt: new Date(),
      },
    });
    await appendTraceEvent(input.callId, {
      kind: input.toolStatus === "completed" ? "tool_success" : "tool_failure",
      tool: input.toolType,
      detail: {
        latencyMs: input.latencyMs,
        executionId: execution.id,
        ...(input.toolError ? { error: input.toolError } : {}),
      },
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        source: "record-call-telemetry",
        event: "tool_persist_failed",
        callId: input.callId,
        toolType: input.toolType,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export async function recordCallTelemetryForPython(input: {
  workspaceId: string;
  callId: string;
  agentId?: string;
  kind: string;
  metrics?: Record<string, unknown>;
  toolType?: string;
  toolArgs?: Record<string, unknown>;
  toolStatus?: "completed" | "failed";
  toolOutput?: unknown;
  toolError?: string;
  latencyMs?: number;
}): Promise<{ ok: true }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { id: true, metadata: true },
  });

  if (call && input.metrics && Object.keys(input.metrics).length) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    const prev = (meta[METRICS_KEY] || {}) as Record<string, unknown>;
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: {
        metadata: {
          ...meta,
          [METRICS_KEY]: {
            ...prev,
            ...input.metrics,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  await appendTraceEvent(input.callId, {
    kind: input.kind,
    tool: input.toolType,
    detail: {
      agentId: input.agentId,
      latencyMs: input.latencyMs,
      ...(input.metrics || {}),
      ...(input.toolError ? { error: input.toolError } : {}),
      ...(input.toolOutput !== undefined ? { output: input.toolOutput } : {}),
    },
  }).catch(() => undefined);

  if (input.toolType && input.toolStatus) {
    await persistToolExecution({
      workspaceId: input.workspaceId,
      callId: input.callId,
      toolType: input.toolType,
      toolArgs: input.toolArgs,
      toolStatus: input.toolStatus,
      toolOutput: input.toolOutput,
      toolError: input.toolError,
      latencyMs: input.latencyMs,
    });
  }

  console.log(
    JSON.stringify({
      source: "python-voice-runtime-bridge",
      event: "record_call_telemetry",
      callId: input.callId,
      workspaceId: input.workspaceId,
      kind: input.kind,
      toolType: input.toolType,
      latencyMs: input.latencyMs,
      metrics: input.metrics,
      timestamp: new Date().toISOString(),
    }),
  );

  return { ok: true };
}
