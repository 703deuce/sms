/** Structured logging for Python voice telemetry — no heavy imports. */
export async function emitVoiceRuntimeEvent(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  event: string;
  workflow?: string;
  extra?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  console.log(
    JSON.stringify({
      source: "python-voice-runtime-bridge",
      event: input.event,
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: input.workflow,
      timestamp: new Date().toISOString(),
      ...input.extra,
    }),
  );
  return { ok: true };
}
