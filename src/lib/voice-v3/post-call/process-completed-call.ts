import "server-only";

import { getPrisma } from "@/lib/db";
import { processPostCall } from "@/lib/voice/post-call";
import { enqueueVoiceV3PostCallJob } from "./enqueue";
import { loadVoiceV3PostCallSystemFacts } from "./system-facts";
import { getRecordingStatusForCall } from "./recording";
import { transcribeRecordingWithDeepgram } from "./transcription";
import { ensureVoiceV3CallSummary } from "./summary";
import { persistKnowledgeGapCandidates } from "./knowledge-gaps";
import { sendVoiceV3PostCallSummaryEmail } from "./email";
import { emitVoiceV3PostCallWebhooks } from "./webhooks";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Idempotent Voice V3 post-call pipeline — single processor for recording → transcript → summary → side effects. */
export async function processVoiceV3CompletedCall(callId: string): Promise<{ ok: boolean }> {
  const facts = await loadVoiceV3PostCallSystemFacts(callId);
  if (!facts) return { ok: false };

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return { ok: false };

  const meta = asRecord(call.metadata);
  const postCallState = asRecord(meta.voiceV3PostCall);
  if (postCallState.pipelineCompletedAt) {
    return { ok: true };
  }

  const attempts = Number(postCallState.attempts || 0) + 1;
  postCallState.attempts = attempts;
  postCallState.lastAttemptAt = new Date().toISOString();

  // Shared usage / legacy automations (preserve existing behavior).
  if (!postCallState.sharedPostCallDone) {
    await processPostCall(callId, { skipInsightGeneration: true, skipV3ImmediateNotification: true });
    postCallState.sharedPostCallDone = true;
  }

  const recording = await getRecordingStatusForCall(callId);
  const recordingReady =
    recording?.status === "ready" && Boolean(recording.storageUrl || recording.id);

  if (!recordingReady) {
    postCallState.recording = recording?.status || "pending";
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { metadata: { ...meta, voiceV3PostCall: postCallState } as object },
    });
    if (attempts < 40) {
      const delay = attempts < 5 ? 15 : attempts < 15 ? 30 : 60;
      await enqueueVoiceV3PostCallJob({
        workspaceId: facts.workspaceId,
        callId,
        delaySeconds: delay,
      });
    }
    return { ok: true };
  }

  if (recording) {
    await transcribeRecordingWithDeepgram({
      workspaceId: facts.workspaceId,
      callId,
      recordingId: recording.id,
      channels: recording.channels,
    });
  }

  const transcript = await prisma.voiceTranscript.findFirst({
    where: { callId, workspaceId: facts.workspaceId },
  });
  const transcriptText = transcript?.fullText || "";

  const summary = await ensureVoiceV3CallSummary({
    callId,
    workspaceId: facts.workspaceId,
    facts,
    transcriptPlainText: transcriptText,
  });

  await persistKnowledgeGapCandidates({
    workspaceId: facts.workspaceId,
    callId,
    candidates: summary.knowledgeGapCandidates || [],
  });

  await sendVoiceV3PostCallSummaryEmail({ callId, workspaceId: facts.workspaceId, summary, facts }).catch(
    (err) => console.error("VOICE_V3_POST_CALL_EMAIL_FAILED", err),
  );

  await emitVoiceV3PostCallWebhooks({ callId, workspaceId: facts.workspaceId, summary, facts }).catch(
    (err) => console.error("VOICE_V3_POST_CALL_WEBHOOK_FAILED", err),
  );

  postCallState.pipelineCompletedAt = new Date().toISOString();
  postCallState.recording = "ready";
  postCallState.transcript = transcript?.status || "unknown";
  postCallState.summaryOutcome = summary.outcome;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        voiceV3PostCall: postCallState,
        voiceV3Analytics: {
          outcome: summary.outcome,
          reasonCategory: summary.reasonCategory,
          reasonForCall: summary.reasonForCall,
          urgency: summary.urgency,
          actionRequired: summary.actionRequired,
          afterHours: true,
        },
      } as object,
    },
  });

  return { ok: true };
}
