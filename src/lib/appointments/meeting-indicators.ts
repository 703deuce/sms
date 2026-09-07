import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";

export type AppointmentMeetingIndicator = {
  notetakerStatus?: string | null;
  notetakerSessionId?: string | null;
  notetakerEnabled?: boolean;
  videoStatus?: string | null;
  videoProvisioningStatus?: string | null;
  videoMeetingId?: string | null;
  videoJoinUrl?: string | null;
  recapReady?: boolean;
  recapSessionId?: string | null;
};

export async function getAppointmentMeetingIndicators(
  workspaceId: string,
  appointmentIds: string[],
): Promise<Record<string, AppointmentMeetingIndicator>> {
  if (!appointmentIds.length) return {};

  const prisma = getPrisma();
  const uniqueIds = [...new Set(appointmentIds)];

  const [sessions, videoMeetings, appointments] = await Promise.all([
    prisma.meetingSession.findMany({
      where: { workspaceId, appointmentId: { in: uniqueIds }, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.videoMeeting.findMany({
      where: {
        workspaceId,
        appointmentId: { in: uniqueIds },
        provisioningStatus: { not: "deleted" },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.voiceAppointment.findMany({
      where: { workspaceId, id: { in: uniqueIds } },
      select: { id: true, metadata: true },
    }),
  ]);

  const metaById = new Map<string, Record<string, unknown>>(
    appointments.map((row: DbRow) => [String(row.id), (row.metadata || {}) as Record<string, unknown>]),
  );

  const out: Record<string, AppointmentMeetingIndicator> = {};
  for (const id of uniqueIds) {
    const meta = metaById.get(id);
    out[id] = {
      notetakerEnabled: Boolean(meta?.notetakerEnabled),
    };
  }

  for (const session of sessions) {
    if (!session.appointmentId) continue;
    const current = out[session.appointmentId] || {};
    if (session.meetingSource === "transovo_video") {
      if (!current.videoStatus) {
        out[session.appointmentId] = {
          ...current,
          videoStatus: session.status,
          recapReady: session.status === "completed" || session.summaryStatus === "ready",
          recapSessionId:
            session.status === "completed" || session.summaryStatus === "ready"
              ? session.id
              : current.recapSessionId,
        };
      }
      continue;
    }

    if (!current.notetakerSessionId) {
      out[session.appointmentId] = {
        ...current,
        notetakerStatus: session.status,
        notetakerSessionId: session.id,
        notetakerEnabled: session.enabled,
        recapReady:
          session.status === "completed" ||
          session.summaryStatus === "ready" ||
          Boolean(current.recapReady),
        recapSessionId:
          session.status === "completed" || session.summaryStatus === "ready"
            ? session.id
            : current.recapSessionId,
      };
    }
  }

  for (const video of videoMeetings) {
    if (!video.appointmentId) continue;
    const current = out[video.appointmentId] || {};
    if (!current.videoMeetingId) {
      out[video.appointmentId] = {
        ...current,
        videoStatus: video.status,
        videoProvisioningStatus: video.provisioningStatus,
        videoMeetingId: video.id,
        videoJoinUrl:
          video.provisioningStatus === "ready"
            ? publicVideoMeetingUrl(video.publicMeetingToken)
            : null,
      };
    }
  }

  return out;
}
