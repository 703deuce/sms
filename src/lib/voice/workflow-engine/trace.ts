import { getPrisma } from "@/lib/db";
import { loadAgentRuntime, saveAgentRuntime } from "./runtime-state";

export type TraceEvent = {
  at: string;
  kind: string;
  tool?: string;
  operation_id?: string;
  workflow_state?: string;
  detail?: Record<string, unknown>;
};

const TRACE_KEY = "executionTrace";

export async function appendTraceEvent(callId: string, event: Omit<TraceEvent, "at">): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta = (call.metadata || {}) as Record<string, unknown>;
  const runtime = await loadAgentRuntime(callId);
  const trace: TraceEvent[] = Array.isArray(meta[TRACE_KEY])
    ? (meta[TRACE_KEY] as TraceEvent[])
    : [];
  const entry: TraceEvent = {
    at: new Date().toISOString(),
    ...event,
    workflow_state: event.workflow_state || runtime?.state,
  };
  const nextTrace = [...trace.slice(-199), entry];
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        [TRACE_KEY]: nextTrace,
      },
    },
  });
  if (runtime) {
    await saveAgentRuntime(callId, runtime);
  }
}

export async function loadExecutionTrace(callId: string): Promise<TraceEvent[]> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  return Array.isArray(meta[TRACE_KEY]) ? (meta[TRACE_KEY] as TraceEvent[]) : [];
}
