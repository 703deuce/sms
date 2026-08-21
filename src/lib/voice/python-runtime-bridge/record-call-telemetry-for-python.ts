import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

const METRICS_KEY = "livekitCallMetrics";
const MAX_TURN_ROWS = 50;

export function mergeTurnLatency(
  prev: Record<string, unknown>,
  metrics: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metrics) return prev;
  const turnNumber = metrics.turnNumber;
  if (typeof turnNumber !== "number") return prev;

  const existing = Array.isArray(prev.turnLatencies)
    ? (prev.turnLatencies as Record<string, unknown>[])
    : [];
  const nextRow = {
    turnNumber,
    userToAgentResponseMs:
      typeof metrics.userToAgentResponseMs === "number" ? metrics.userToAgentResponseMs : null,
    responseMsFromCallStart:
      typeof metrics.responseMsFromCallStart === "number"
        ? metrics.responseMsFromCallStart
        : null,
    responseSource:
      typeof metrics.responseSource === "string" ? metrics.responseSource : undefined,
    proactive: metrics.proactive === true,
    at: new Date().toISOString(),
  };
  const turnLatencies = [...existing.filter((row) => row.turnNumber !== turnNumber), nextRow]
    .sort((a, b) => Number(a.turnNumber) - Number(b.turnNumber))
    .slice(-MAX_TURN_ROWS);

  const userLatencies = turnLatencies
    .map((row) => row.userToAgentResponseMs)
    .filter((value): value is number => typeof value === "number");

  const merged: Record<string, unknown> = {
    ...prev,
    turnCount: turnLatencies.length,
    turnLatencies,
    updatedAt: new Date().toISOString(),
  };

  if (userLatencies.length) {
    merged.avgUserToAgentResponseMs = Math.round(
      userLatencies.reduce((sum, value) => sum + value, 0) / userLatencies.length,
    );
    merged.maxUserToAgentResponseMs = Math.max(...userLatencies);
    merged.minUserToAgentResponseMs = Math.min(...userLatencies);
    merged.lastUserToAgentResponseMs = userLatencies[userLatencies.length - 1];
  }

  if (typeof metrics.userTurnCount === "number") {
    merged.userTurnCount = metrics.userTurnCount;
  }

  return merged;
}

function mergeCallMetrics(
  prev: Record<string, unknown>,
  kind: string,
  metrics: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (kind === "turn_response") {
    return mergeTurnLatency(prev, metrics);
  }
  if (kind === "call_summary" && metrics?.turnLatencies) {
    return {
      ...prev,
      ...metrics,
      updatedAt: new Date().toISOString(),
    };
  }
  if (metrics && Object.keys(metrics).length) {
    return {
      ...prev,
      ...metrics,
      updatedAt: new Date().toISOString(),
    };
  }
  return prev;
}

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

  if (call && (input.metrics || input.kind === "turn_response")) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    const prev = (meta[METRICS_KEY] || {}) as Record<string, unknown>;
    const nextMetrics = mergeCallMetrics(prev, input.kind, input.metrics);
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: {
        metadata: {
          ...meta,
          [METRICS_KEY]: nextMetrics,
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
