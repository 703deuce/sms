import "server-only";

import { getPrisma } from "@/lib/db";
import { createSignedRecordingUrl } from "./call-recording-storage";

export async function queueRecordingTranscription(recordingId: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallRecording.findUnique({ where: { id: recordingId } });
  if (!row?.storagePath || !row.storageBucket) return;

  const { workspaceHasAiTranscriptionEntitlement } = await import(
    "@/lib/transcription/entitlement"
  );
  const entitled = await workspaceHasAiTranscriptionEntitlement(row.workspaceId);
  if (!entitled) {
    await prisma.smartRoutingCallRecording.update({
      where: { id: recordingId },
      data: { transcriptStatus: "disabled" },
    });
    return;
  }

  const signedUrl = await createSignedRecordingUrl(row.storageBucket, row.storagePath, 600);
  const { enqueueTranscriptionJob } = await import("@/lib/transcription/service");
  await enqueueTranscriptionJob({
    workspaceId: row.workspaceId,
    sourceType: "smart_routing_recording",
    sourceId: recordingId,
    recordingUrl: signedUrl,
    provider: row.provider,
    durationSeconds: row.durationSeconds,
    diarize: true,
  });
}

export async function queueRecordingSummary(recordingId: string, transcript?: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallRecording.findUnique({ where: { id: recordingId } });
  const text = transcript ?? row?.transcriptText;
  if (!text?.trim()) return;

  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: row?.workspaceId ?? "" },
    select: { recordingSummaryEnabled: true },
  });
  if (!settings?.recordingSummaryEnabled) return;

  try {
    const { summarizeVoicemailTranscript } = await import("@/lib/phone/voicemail-post-process");
    const summary = await summarizeVoicemailTranscript(text);
    await prisma.smartRoutingCallRecording.update({
      where: { id: recordingId },
      data: {
        aiSummary: summary?.trim() || null,
        summaryStatus: summary?.trim() ? "ready" : "failed",
      },
    });
  } catch {
    await prisma.smartRoutingCallRecording.update({
      where: { id: recordingId },
      data: { summaryStatus: "failed" },
    });
  }
}
