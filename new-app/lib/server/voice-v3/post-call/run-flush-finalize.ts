import "server-only";

import { snapshotVoiceV3CallForensics } from "@/lib/server/voice-v3/telemetry/call-forensics";
import { finalizeVoiceV3Call } from "@/lib/server/voice-v3/post-call/finalize";

function formatTranscriptFromCanonicalTurns(
  turns: Array<{ role: string; text: string }>,
): string {
  const lines: string[] = [];
  for (const t of turns) {
    const text = t.text?.trim();
    if (!text) continue;
    const prefix =
      t.role === "user" ? "Caller:" : t.role === "assistant" ? "Agent:" : "System:";
    lines.push(`${prefix} ${text}`);
  }
  return lines.join("\n");
}

/**
 * Synchronous post-call finalize when the Python worker flushes forensics (replaces monolith
 * voice_v3_call_history enqueueJob stub in new-app).
 */
export async function runVoiceV3FlushFinalize(input: {
  liveSessionId: string;
  callId: string;
  workspaceId: string;
  errorMessage?: string | null;
}): Promise<{ ok: true; duplicate?: boolean } | { ok: false; code: string; message: string }> {
  const { getPrisma } = await import("@/lib/server/db");
  const existing = await getPrisma().voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { outcome: true },
  });

  const snap = snapshotVoiceV3CallForensics(input.liveSessionId);
  const transcript = snap
    ? formatTranscriptFromCanonicalTurns(
        snap.canonicalTurns.map((t) => ({ role: t.role, text: t.text })),
      )
    : "";

  const idempotencyKey = `python_flush:${input.liveSessionId}`;
  const preservedOutcome = existing?.outcome?.trim();
  const outcome =
    input.errorMessage?.trim()
      ? "session_error"
      : preservedOutcome && ["message_left", "callback_requested", "transferred"].includes(preservedOutcome)
        ? preservedOutcome
        : transcript
          ? "ai_handled"
          : "completed";

  const result = await finalizeVoiceV3Call({
    workspaceId: input.workspaceId,
    callId: input.callId,
    transcript: transcript || null,
    summary: transcript ? transcript.slice(0, 500) : null,
    outcome,
    idempotencyKey,
    durationSeconds: null,
  });

  if (!result.ok && result.code === "not_found") {
    console.error("VOICE_V3_FLUSH_FINALIZE_CALL_MISSING", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      liveSessionId: input.liveSessionId,
    });
    return { ok: false, code: "not_found", message: result.message || "Call not found" };
  }

  if (input.errorMessage?.trim()) {
    const { getPrisma } = await import("@/lib/server/db");
    await getPrisma().voiceCall.update({
      where: { id: input.callId },
      data: { errorMessage: input.errorMessage.trim() },
    });
  }

  return { ok: true, duplicate: result.duplicate === true };
}
