import "server-only";

import { getPrisma } from "@/lib/db";
import { createSignedRecordingUrl } from "./call-recording-storage";

export async function queueRecordingTranscription(recordingId: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallRecording.findUnique({ where: { id: recordingId } });
  if (!row?.storagePath || !row.storageBucket) return;

  try {
    const signedUrl = await createSignedRecordingUrl(row.storageBucket, row.storagePath, 600);
    const { transcribeAudioUrl } = await import("@/lib/phone/voicemail-transcribe");
    const result = await transcribeAudioUrl(signedUrl);
    const text = result.text?.trim() || null;
    await prisma.smartRoutingCallRecording.update({
      where: { id: recordingId },
      data: {
        transcriptText: text,
        transcriptStatus: text ? "ready" : "failed",
      },
    });

    if (text && row.summaryStatus !== "disabled") {
      await queueRecordingSummary(recordingId, text);
    }
  } catch {
    await prisma.smartRoutingCallRecording.update({
      where: { id: recordingId },
      data: { transcriptStatus: "failed" },
    });
  }
}

export async function queueRecordingSummary(recordingId: string, transcript?: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallRecording.findUnique({ where: { id: recordingId } });
  const text = transcript ?? row?.transcriptText;
  if (!text?.trim()) return;

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
