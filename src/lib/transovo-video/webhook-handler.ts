import "server-only";

import { getPrisma } from "@/lib/db";
import { finalizeVideoMeeting } from "./service";
import { processTransovoVideoArtifacts } from "./processing";

export async function processTelnyxVideoRoomWebhook(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}) {
  const eventType = input.eventType.toLowerCase();
  const payload = input.eventPayload;
  const roomId = String(payload.room_id || payload.roomId || "");
  const sessionId = String(payload.session_id || payload.sessionId || payload.id || "");
  const compositionId = String(payload.composition_id || payload.id || "");

  const prisma = getPrisma();
  let meeting =
    roomId
      ? await prisma.videoMeeting.findFirst({ where: { providerRoomId: roomId } })
      : null;

  if (!meeting && sessionId) {
    meeting = await prisma.videoMeeting.findFirst({
      where: { providerActiveSessionId: sessionId },
    });
  }

  if (!meeting && compositionId) {
    meeting = await prisma.videoMeeting.findFirst({ where: { compositionId } });
  }

  if (!meeting) {
    return { handled: false, reason: "meeting_not_found" };
  }

  if (eventType.includes("session") && eventType.includes("started")) {
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: {
        providerActiveSessionId: sessionId || meeting.providerActiveSessionId,
        status: "active",
        recordingStatus:
          meeting.recordingMode !== "off" ? "recording" : meeting.recordingStatus,
      },
    });
    return { handled: true };
  }

  if (eventType.includes("session") && eventType.includes("ended")) {
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: {
        providerActiveSessionId: sessionId || meeting.providerActiveSessionId,
        recordingStatus:
          meeting.recordingMode !== "off" ? "processing" : meeting.recordingStatus,
      },
    });
    await finalizeVideoMeeting(meeting.id);
    return { handled: true };
  }

  if (eventType.includes("composition") && eventType.includes("completed")) {
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: { compositionStatus: "ready", compositionId: compositionId || meeting.compositionId },
    });
    await processTransovoVideoArtifacts(meeting.id);
    return { handled: true };
  }

  if (eventType.includes("composition") && eventType.includes("failed")) {
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: { compositionStatus: "failed" },
    });
    return { handled: true };
  }

  if (eventType.includes("recording") && eventType.includes("completed")) {
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: { recordingStatus: "processing" },
    });
    return { handled: true };
  }

  return { handled: false, reason: "unhandled_event" };
}
