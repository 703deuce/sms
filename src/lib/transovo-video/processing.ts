import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueMeetingProcessing } from "@/lib/meeting-assistant/service";
import { telnyxVideoWebhookUrl } from "./meeting-url";
import {
  telnyxCreateRoomComposition,
  telnyxListRoomRecordings,
  telnyxRetrieveRoomComposition,
  telnyxRetrieveRoomRecording,
} from "./telnyx-video-provider";
import { ensureMeetingSessionForVideo } from "./service";

async function copyRecordingToStorage(url: string, key: string, workspaceId: string): Promise<string | null> {
  try {
    const { uploadFromUrl } = await import("@/lib/storage/upload-from-url");
    return await uploadFromUrl({ url, key, contentType: "video/mp4", workspaceId });
  } catch {
    return null;
  }
}

export async function processTransovoVideoArtifacts(videoMeetingId: string) {
  const prisma = getPrisma();
  const meeting = await prisma.videoMeeting.findUnique({ where: { id: videoMeetingId } });
  if (!meeting) return { skipped: true };

  const session = await ensureMeetingSessionForVideo(videoMeetingId);
  if (!session) return { skipped: true };

  await prisma.meetingSession.update({
    where: { id: session.id },
    data: { status: "processing" },
  });

  if (!meeting.providerActiveSessionId || !process.env.TELNYX_API_KEY) {
    if (meeting.aiRecapEnabled || meeting.transcriptionEnabled) {
      await enqueueMeetingProcessing(session.id, meeting.workspaceId);
    }
    return { deferred: true };
  }

  let compositionId = meeting.compositionId;
  if (!compositionId && meeting.recordingMode !== "off") {
    const composition = await telnyxCreateRoomComposition({
      sessionId: meeting.providerActiveSessionId,
      webhookUrl: telnyxVideoWebhookUrl(),
    });
    compositionId = String(composition?.id || "");
    await prisma.videoMeeting.update({
      where: { id: videoMeetingId },
      data: {
        compositionId,
        compositionStatus: "processing",
        recordingStatus: "processing",
      },
    });
  }

  if (compositionId) {
    const composition = await telnyxRetrieveRoomComposition(compositionId).catch(() => null);
    const status = String(composition?.status || "").toLowerCase();
    const downloadUrl =
      (composition?.download_url as string) ||
      (composition?.url as string) ||
      null;

    if (status === "completed" && downloadUrl) {
      const storagePath = await copyRecordingToStorage(
        downloadUrl,
        `video-meetings/${meeting.workspaceId}/${meeting.id}.mp4`,
        meeting.workspaceId,
      );
      await prisma.videoMeeting.update({
        where: { id: videoMeetingId },
        data: {
          compositionStatus: "ready",
          recordingStatus: "ready",
          recordingProviderUrl: downloadUrl,
          recordingStoragePath: storagePath,
        },
      });
      await prisma.meetingSession.update({
        where: { id: session.id },
        data: {
          recordingProviderUrl: downloadUrl,
          recordingStoragePath: storagePath,
          recordingStatus: "ready",
        },
      });
    } else if (status === "failed") {
      await prisma.videoMeeting.update({
        where: { id: videoMeetingId },
        data: { compositionStatus: "failed", recordingStatus: "failed" },
      });
    } else {
      return { processing: true, compositionId };
    }
  } else {
    const recordings = await telnyxListRoomRecordings(meeting.providerActiveSessionId);
    const first = recordings[0] as { id?: string; status?: string } | undefined;
    if (first?.id) {
      const rec = await telnyxRetrieveRoomRecording(first.id).catch(() => null);
      const downloadUrl = (rec?.download_url as string) || (rec?.url as string) || null;
      if (downloadUrl) {
        await prisma.videoMeeting.update({
          where: { id: videoMeetingId },
          data: { recordingProviderUrl: downloadUrl, recordingStatus: "ready" },
        });
        await prisma.meetingSession.update({
          where: { id: session.id },
          data: { recordingProviderUrl: downloadUrl, recordingStatus: "ready" },
        });
      }
    }
  }

  if (meeting.transcriptionEnabled || meeting.aiRecapEnabled) {
    await prisma.meetingSession.update({
      where: { id: session.id },
      data: {
        transcriptStatus: meeting.transcriptionEnabled ? "processing" : session.transcriptStatus,
        summaryStatus: meeting.aiRecapEnabled ? "processing" : session.summaryStatus,
      },
    });
    await enqueueMeetingProcessing(session.id, meeting.workspaceId);
  } else {
    await prisma.meetingSession.update({
      where: { id: session.id },
      data: { status: "completed" },
    });
  }

  return { completed: true };
}
