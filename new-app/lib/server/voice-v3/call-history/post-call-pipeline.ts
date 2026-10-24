import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { validateNativeCustomerTranscript } from "./native-transcript-validator";
import { runDeepgramFallbackForCall } from "./deepgram-fallback";
import { ensureCallHistorySummary } from "./summary";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function isVoiceV3CallHistoryEligible(metadata: unknown): boolean {
  const meta = asRecord(metadata);
  const voiceV3 = asRecord(meta.voiceV3);
  return (
    meta.voiceTransport === "voice_v3_basic" ||
    meta.voiceV3WizardBound === true ||
    Boolean(voiceV3.callId)
  );
}

function pickCustomerTranscript(
  transcripts: Array<{
    id: string;
    provider: string;
    status: string;
    fullText: string | null;
    segments: Array<{
      speaker: string;
      text: string;
      startMs: number | null;
      endMs: number | null;
    }>;
  }>,
) {
  const native = transcripts.find(
    (t) =>
      (t.provider === "voice_v3_livekit" || t.provider === "livekit") &&
      t.status === "completed",
  );
  if (native) return native;
  const deepgram = transcripts.find((t) => t.provider === "deepgram" && t.status === "completed");
  if (deepgram) return deepgram;
  return transcripts.find((t) => t.status === "completed") ?? transcripts[0];
}

export async function runVoiceV3CallHistoryPostProcess(
  callId: string,
): Promise<{ ok: true; status: string } | { ok: false; reason: string }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      workspaceId: true,
      metadata: true,
      durationSeconds: true,
      status: true,
    },
  });
  if (!call) return { ok: false, reason: "call_not_found" };
  if (!isVoiceV3CallHistoryEligible(call.metadata)) {
    return { ok: false, reason: "not_voice_v3" };
  }

  const meta = asRecord(call.metadata);
  const forensics = asRecord(meta.voiceV3Forensics);
  const forensicsFinal = forensics.final === true;

  await import("@/lib/voice-v3/call-history/materialize-native-transcript").then((m) =>
    m.materializeNativeTranscriptFromForensicsIfNeeded(callId, call.workspaceId),
  );

  const [transcriptRows, recording] = await Promise.all([
    prisma.voiceTranscript.findMany({ where: { callId } }),
    prisma.voiceRecording.findFirst({
      where: { callId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const transcripts = await Promise.all(
    (transcriptRows ?? []).map(async (t) => ({
      ...t,
      segments:
        (await prisma.voiceTranscriptSegment.findMany({
          where: { transcriptId: t.id },
          orderBy: { startMs: "asc" },
        })) ?? [],
    })),
  );

  let chosen = pickCustomerTranscript(transcripts);
  let segments = chosen?.segments ?? [];
  const validation = validateNativeCustomerTranscript({
    segments,
    durationSeconds: call.durationSeconds,
    forensicsFinal: chosen?.provider === "deepgram" ? true : forensicsFinal,
  });

  let transcriptProvider = chosen?.provider || "none";
  let transcriptStatus = chosen?.status || "pending";

  if (
    chosen &&
    (chosen.provider === "voice_v3_livekit" || chosen.provider === "livekit") &&
    validation.valid
  ) {
    console.log("VOICE_TRANSCRIPT_NATIVE_ACCEPTED", {
      callId,
      callerTurns: validation.callerTurns,
      agentTurns: validation.agentTurns,
    });
    transcriptProvider = "native";
    transcriptStatus = "completed";
  } else if (
    chosen &&
    (chosen.provider === "voice_v3_livekit" || chosen.provider === "livekit") &&
    !validation.valid
  ) {
    console.log("VOICE_TRANSCRIPT_NATIVE_REJECTED", {
      callId,
      reasons: validation.reasons,
    });
    if (recording?.storageUrl && recording.status === "ready") {
      await runDeepgramFallbackForCall({
        workspaceId: call.workspaceId,
        callId,
        recordingId: recording.id,
        storageUrl: recording.storageUrl,
        channels: recording.channels,
      });
      const refreshed = await prisma.voiceTranscript.findFirst({
        where: { callId, provider: "deepgram", status: "completed" },
        include: { segments: { orderBy: { startMs: "asc" } } },
      });
      if (refreshed) {
        transcriptProvider = "deepgram";
        transcriptStatus = "completed";
        chosen = refreshed;
        segments = refreshed.segments;
      } else {
        transcriptStatus = "processing";
      }
    } else {
      transcriptStatus = "processing";
    }
  } else if (chosen?.provider === "deepgram") {
    transcriptProvider = "deepgram";
  }

  const transcriptText = chosen?.fullText || segments.map((s) => s.text).join(" ") || "";
  let summaryText = "";
  if (transcriptText.trim() && transcriptStatus === "completed") {
    const summaryResult = await ensureCallHistorySummary({
      workspaceId: call.workspaceId,
      callId,
      transcriptText,
    }).catch((err) => {
      console.warn("VOICE_CALL_SUMMARY_FAILED", {
        callId,
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    summaryText = summaryResult?.summary?.trim() || transcriptText.slice(0, 500);
  }

  const recordingStatus = recording?.status || "not_requested";
  const nextMeta = {
    ...meta,
    callHistory: {
      recordingStatus,
      transcriptStatus,
      transcriptProvider,
      validationReasons: validation.reasons,
      updatedAt: new Date().toISOString(),
    },
  };

  await prisma.voiceCall.update({
    where: { id: callId },
    data: { metadata: nextMeta as Prisma.InputJsonValue },
  });

  console.log("VOICE_CALL_POSTPROCESS_COMPLETE", {
    callId,
    recordingStatus,
    transcriptStatus,
    transcriptProvider,
  });

  void (async () => {
    try {
      if (summaryText.trim()) {
        const { runVoiceV3PostCallSideEffects } = await import(
          "../post-call/run-post-call-side-effects"
        );
        await runVoiceV3PostCallSideEffects({
          callId,
          workspaceId: call.workspaceId,
          summaryText,
        });
      }
    } catch (err) {
      console.error("VOICE_V3_POST_CALL_SIDE_EFFECTS_FAILED", {
        callId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      const { loadVoiceV3NotificationsConfigForCall } = await import(
        "../notifications/load-config-for-call"
      );
      const { maybeSendVoiceV3AiCallRecoverySms } = await import("../post-call/ai-call-recovery-sms");
      const loaded = await loadVoiceV3NotificationsConfigForCall(callId);
      if (!loaded) return;
      await maybeSendVoiceV3AiCallRecoverySms({
        callId,
        workspaceId: call.workspaceId,
        config: loaded.config,
      });
    } catch (err) {
      console.error("VOICE_V3_AI_CALL_RECOVERY_SMS_FAILED", {
        callId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  return { ok: true, status: transcriptStatus };
}
