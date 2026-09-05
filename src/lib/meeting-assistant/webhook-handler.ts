import "server-only";

import { getPrisma } from "@/lib/db";
import {
  mapTelnyxMeetingSessionToDbPatch,
  mapTelnyxMeetingStatus,
  telnyxGetMeetingSession,
} from "./telnyx-provider";
import { enqueueMeetingProcessing, updateMeetingSessionStatus } from "./service";

export async function processTelnyxMeetingWebhook(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean }> {
  const eventType = input.eventType.toLowerCase();
  const payload = input.eventPayload;
  const providerSessionId = String(
    payload.meeting_session_id ||
      payload.session_id ||
      (payload.data as { id?: string })?.id ||
      "",
  );
  if (!providerSessionId) return { handled: false };

  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { providerSessionId },
  });
  if (!session) return { handled: false };

  if (process.env.TELNYX_API_KEY) {
    const live = await telnyxGetMeetingSession(providerSessionId).catch(() => null);
    if (live?.id) {
      const patch = mapTelnyxMeetingSessionToDbPatch(live);
      await prisma.meetingSession.update({
        where: { id: session.id },
        data: patch,
      });
    }
  }

  const status = mapTelnyxMeetingStatus(
    String(payload.status || payload.state || eventType),
  );

  if (eventType.includes("artifact") && eventType.includes("complete")) {
    await enqueueMeetingProcessing(session.id, session.workspaceId);
    return { handled: true };
  }

  if (eventType.includes("transcript") && eventType.includes("complete")) {
    await prisma.meetingSession.update({
      where: { id: session.id },
      data: { transcriptStatus: "ready" },
    });
    return { handled: true };
  }

  if (eventType.includes("recording") && (eventType.includes("available") || eventType.includes("complete"))) {
    await prisma.meetingSession.update({
      where: { id: session.id },
      data: { recordingStatus: "ready" },
    });
    return { handled: true };
  }

  if (eventType.includes("ended") || eventType.includes("end")) {
    await updateMeetingSessionStatus(session.id, "ended", { endedAt: new Date() });
    await enqueueMeetingProcessing(session.id, session.workspaceId);
    const { onMeetingCompleted } = await import("./workflow-triggers");
    await onMeetingCompleted(session.workspaceId, session.id, session.appointmentId);
    return { handled: true };
  }

  if (eventType.includes("fail")) {
    await updateMeetingSessionStatus(session.id, "failed", {
      failureMessage: String(payload.failure_reason || payload.message || eventType),
    });
    return { handled: true };
  }

  if (eventType.includes("cancel")) {
    await updateMeetingSessionStatus(session.id, "canceled");
    return { handled: true };
  }

  if (eventType.includes("admit") || eventType.includes("waiting") || eventType.includes("lobby")) {
    await updateMeetingSessionStatus(session.id, "awaiting_admission");
    return { handled: true };
  }

  if (eventType.includes("joined") || eventType.includes("active")) {
    await updateMeetingSessionStatus(session.id, "active", { actualStartAt: new Date() });
    return { handled: true };
  }

  await updateMeetingSessionStatus(session.id, status);
  return { handled: true };
}
