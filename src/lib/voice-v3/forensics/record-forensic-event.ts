import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

export async function recordVoiceV3ForensicEvent(input: {
  workspaceId: string;
  callId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const prisma = getPrisma();
  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      eventType: input.eventType,
      payload: input.payload ?? {},
    },
  });
  await appendTraceEvent(input.callId, {
    kind: input.eventType,
    detail: input.payload,
  }).catch(() => undefined);
}

export async function persistVoiceV3ToolForensics(input: {
  workspaceId: string;
  callId: string;
  toolName: string;
  operationId?: string | null;
  conversationRevision?: number | null;
  schedulingGeneration?: number | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  outcome: "success" | "error" | "stale" | "blocked";
  normalizedErrorCode?: string | null;
  summary?: Record<string, unknown>;
}): Promise<void> {
  await recordVoiceV3ForensicEvent({
    workspaceId: input.workspaceId,
    callId: input.callId,
    eventType: "VOICE_V3_TOOL_EXECUTION",
    payload: {
      toolName: input.toolName,
      operationId: input.operationId,
      conversationRevision: input.conversationRevision,
      schedulingGeneration: input.schedulingGeneration,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      durationMs: input.durationMs,
      outcome: input.outcome,
      normalizedErrorCode: input.normalizedErrorCode,
      ...input.summary,
    },
  });
}
