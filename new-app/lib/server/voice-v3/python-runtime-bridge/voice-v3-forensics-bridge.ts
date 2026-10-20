import "server-only";

import {
  appendVoiceV3ForensicEvent,
  finalizeVoiceV3CallForensics,
  ingestPythonForensicEvents,
  mergeCanonicalConversationTurn,
  snapshotVoiceV3CallForensics,
  type VoiceV3ForensicEvent,
} from "@/lib/server/voice-v3/telemetry/call-forensics";
import {
  buildNodeForensicsAttachments,
  persistVoiceV3ForensicsPackage,
} from "@/lib/server/voice-v3/telemetry/forensics-persist";

export async function appendVoiceV3ForensicEventsForPython(input: {
  liveSessionId: string;
  callId: string;
  workspaceId: string;
  agentId: string;
  events: VoiceV3ForensicEvent[];
  canonicalTurns?: Array<{
    turnKey: string;
    role: "user" | "assistant" | "system";
    sequence: number;
    text: string;
    conversationItemId?: string | null;
    committedVia?: string[];
    speech?: Record<string, unknown>;
    textAvailableAt?: string;
  }>;
  checkpoint?: boolean;
}): Promise<{ ok: true; accepted: number }> {
  ingestPythonForensicEvents({
    liveSessionId: input.liveSessionId,
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    events: input.events,
  });

  for (const turn of input.canonicalTurns ?? []) {
    mergeCanonicalConversationTurn(input.liveSessionId, {
      role: turn.role,
      text: turn.text,
      conversationItemId: turn.conversationItemId,
      committedVia: turn.committedVia?.[0] || "python",
      speech: turn.speech,
      textAvailableAt: turn.textAvailableAt,
      turnKey: turn.turnKey,
    });
  }

  if (input.checkpoint) {
    const snap = snapshotVoiceV3CallForensics(input.liveSessionId);
    if (snap) {
      const attachments = await buildNodeForensicsAttachments(input.liveSessionId);
      await persistVoiceV3ForensicsPackage({
        ...snap,
        ...attachments,
        final: false,
        reason: "python_checkpoint",
      }).catch(() => undefined);
    }
  }

  return { ok: true, accepted: input.events.length };
}

export async function flushVoiceV3ForensicsForPython(input: {
  liveSessionId: string;
  callId: string;
  workspaceId: string;
  agentId: string;
  events?: VoiceV3ForensicEvent[];
  canonicalTurns?: Array<{
    turnKey: string;
    role: "user" | "assistant" | "system";
    sequence: number;
    text: string;
    conversationItemId?: string | null;
    committedVia?: string[];
    speech?: Record<string, unknown>;
    textAvailableAt?: string;
  }>;
  sessionHistory?: unknown;
  sessionReport?: unknown;
  gptLiveUsage?: unknown;
  backendLlmUsage?: unknown;
  sessionUsage?: unknown;
  gptLiveSessionId?: string | null;
  liveKitJobId?: string | null;
  roomName?: string | null;
  errorMessage?: string | null;
}): Promise<{ ok: true }> {
  if (input.events?.length) {
    await appendVoiceV3ForensicEventsForPython({
      liveSessionId: input.liveSessionId,
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      events: input.events,
      canonicalTurns: input.canonicalTurns,
    });
  }

  const finalizeResult = await import("@/lib/server/voice-v3/post-call/run-flush-finalize").then(
    (m) =>
      m.runVoiceV3FlushFinalize({
        liveSessionId: input.liveSessionId,
        callId: input.callId,
        workspaceId: input.workspaceId,
        errorMessage: input.errorMessage,
      }),
  );
  if (!finalizeResult.ok) {
    console.error("VOICE_V3_FLUSH_FINALIZE_FAILED", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      code: finalizeResult.code,
      message: finalizeResult.message,
    });
  } else {
    console.info("VOICE_V3_FLUSH_FINALIZE_OK", {
      callId: input.callId,
      workspaceId: input.workspaceId,
      duplicate: finalizeResult.duplicate === true,
    });
  }

  finalizeVoiceV3CallForensics(input.liveSessionId, {
    reason: input.errorMessage ? "error" : "python_flush",
    errorMessage: input.errorMessage,
  });

  const snap = snapshotVoiceV3CallForensics(input.liveSessionId);
  if (snap) {
    const attachments = await buildNodeForensicsAttachments(input.liveSessionId);
    await persistVoiceV3ForensicsPackage({
      ...snap,
      ...attachments,
      final: true,
      reason: input.errorMessage ? "python_flush_error" : "python_flush",
      sessionHistory: input.sessionHistory,
      sessionReport: input.sessionReport,
      gptLiveUsage: input.gptLiveUsage,
      backendLlmUsage: input.backendLlmUsage,
      sessionUsage: input.sessionUsage,
      gptLiveSessionId: input.gptLiveSessionId,
      liveKitJobId: input.liveKitJobId,
      roomName: input.roomName,
    }).catch(() => undefined);
  }

  return { ok: true };
}
