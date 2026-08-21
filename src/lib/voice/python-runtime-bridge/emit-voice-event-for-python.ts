import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

/** Structured logging + call trace for Python voice telemetry. */
export async function emitVoiceRuntimeEvent(input: {
  workspaceId: string;
  agentId?: string;
  callId: string;
  event?: string;
  eventType?: string;
  workflow?: string;
  payload?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  const eventName = input.event || input.eventType || "runtime_event";
  console.log(
    JSON.stringify({
      source: "python-voice-runtime-bridge",
      event: eventName,
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: input.workflow,
      timestamp: new Date().toISOString(),
      ...(input.payload || {}),
      ...(input.extra || {}),
    }),
  );

  if (input.callId) {
    await appendTraceEvent(input.callId, {
      kind: eventName,
      detail: {
        agentId: input.agentId,
        workflow: input.workflow,
        ...(input.payload || {}),
        ...(input.extra || {}),
      },
    }).catch(() => undefined);
  }

  return { ok: true };
}
