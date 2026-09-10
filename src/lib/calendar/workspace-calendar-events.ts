import "server-only";

import { listAppointments, listAppointmentTypes, type ListedAppointmentType } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveServiceCalendarColor, resolveStaffCalendarColor } from "@/lib/appointments/calendar-colors";
import { getPrisma, type DbRow } from "@/lib/db";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";
import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { AppointmentMetadata } from "@/lib/appointments/types";

function mapVideoStatus(status: string) {
  if (status === "canceled") return "canceled";
  if (status === "ended" || status === "failed") return "completed";
  if (status === "scheduled" || status === "waiting") return "scheduled";
  return "confirmed";
}

function mapSessionStatus(status: string) {
  if (status === "canceled" || status === "disabled") return "canceled";
  if (["ended", "completed", "processing", "no_recap", "failed"].includes(status)) {
    return "completed";
  }
  return "scheduled";
}

export async function listWorkspaceCalendarEvents(
  workspaceId: string,
  input: { from?: Date; to?: Date },
): Promise<CalendarApiAppointment[]> {
  const [appointments, platform, types] = await Promise.all([
    listAppointments(workspaceId, { from: input.from, to: input.to }),
    loadAppointmentPlatformConfig(workspaceId),
    listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }),
  ]);

  const typeByName = new Map<string, ListedAppointmentType>(types.map((t) => [t.name, t]));
  const colorConfig = platform.calendarColors;

  const appointmentRows: CalendarApiAppointment[] = appointments.map((row: DbRow) => {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const matchedType = row.serviceName ? typeByName.get(row.serviceName) : undefined;
    const staffId = meta.staffId || undefined;
    const staffMember = staffId ? platform.staff?.find((s) => s.id === staffId) : undefined;
    const location = platform.locations?.find((l) => l.id === meta.locationId);
    const kind = matchedType?.config.bookingTypeKind || "SERVICE";
    const capacity = matchedType?.config.groupCapacity;
    const enrolled = meta.attendeeCount;
    const colorDot = resolveServiceCalendarColor(colorConfig, {
      typeId: matchedType?.id,
      serviceName: row.serviceName,
      typeCalendarColor: matchedType?.config.calendarColor,
    });
    const staffColor = resolveStaffCalendarColor(colorConfig, staffId);

    return {
      id: row.id,
      eventKind: "appointment",
      inviteeName: row.inviteeName,
      inviteePhone: row.inviteePhone,
      serviceName: row.serviceName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      timezone: row.timezone,
      metadata: row.metadata,
      meeting: row.meeting,
      staffId,
      staffName: row.staffName || staffMember?.name || null,
      locationId: meta.locationId || null,
      locationName: location?.name || meta.location || null,
      bookingTypeKind: kind,
      typeId: matchedType?.id || null,
      capacity: capacity ?? null,
      enrolledCount: enrolled ?? null,
      colorDot,
      staffColor,
      isRecurring: Boolean(meta.recurringSeriesId),
      recurringLabel: meta.recurringSeriesId
        ? `Repeats ${matchedType?.config.recurring?.allowedFrequencies?.[0] || "weekly"}`
        : null,
      recurringOccurrenceIndex: meta.recurringOccurrenceIndex ?? null,
      recurringTotal: null,
    };
  });

  if (!input.from || !input.to) {
    return appointmentRows;
  }

  const prisma = getPrisma();
  const [standaloneVideo, standaloneSessions] = await Promise.all([
    prisma.videoMeeting.findMany({
      where: {
        workspaceId,
        appointmentId: null,
        provisioningStatus: { not: "deleted" },
        scheduledStartAt: { gte: input.from, lte: input.to },
        status: { notIn: ["ended", "failed", "canceled"] },
      },
      orderBy: { scheduledStartAt: "asc" },
    }),
    prisma.meetingSession.findMany({
      where: {
        workspaceId,
        appointmentId: null,
        deletedAt: null,
        meetingSource: "external_notetaker",
        scheduledStartAt: { gte: input.from, lte: input.to },
        status: { notIn: ["ended", "completed", "processing", "no_recap", "failed", "canceled", "disabled"] },
      },
      orderBy: { scheduledStartAt: "asc" },
    }),
  ]);

  const videoRows: CalendarApiAppointment[] = standaloneVideo.map((meeting: DbRow) => ({
    id: `video:${meeting.id}`,
    eventKind: "standalone_video",
    inviteeName: "Transovo Video",
    serviceName: meeting.title || "Transovo Video",
    startsAt: meeting.scheduledStartAt?.toISOString() || meeting.createdAt.toISOString(),
    endsAt: meeting.scheduledEndAt?.toISOString() || null,
    status: mapVideoStatus(meeting.status),
    timezone: null,
    standaloneVideoMeetingId: meeting.id,
    meeting: {
      videoStatus: meeting.status,
      videoProvisioningStatus: meeting.provisioningStatus,
      videoMeetingId: meeting.id,
      videoJoinUrl: `/video/rooms/${meeting.id}/host`,
    },
  }));

  const notetakerRows: CalendarApiAppointment[] = standaloneSessions.map((session: DbRow) => ({
    id: `meeting:${session.id}`,
    eventKind: "standalone_notetaker",
    inviteeName: meetingPlatformLabel(session.meetingPlatform as MeetingPlatform),
    serviceName: session.title || "AI Notetaker",
    startsAt: session.scheduledStartAt?.toISOString() || session.createdAt.toISOString(),
    endsAt: session.scheduledStartAt
      ? new Date(session.scheduledStartAt.getTime() + 30 * 60_000).toISOString()
      : null,
    status: mapSessionStatus(session.status),
    timezone: null,
    standaloneMeetingSessionId: session.id,
    meeting: {
      notetakerEnabled: true,
      notetakerStatus: session.status,
      notetakerSessionId: session.id,
      recapReady: session.summaryStatus === "ready",
      recapSessionId: session.id,
    },
  }));

  return [...appointmentRows, ...videoRows, ...notetakerRows].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
}

export function publicGuestVideoUrlFromToken(token: string) {
  return publicVideoMeetingUrl(token);
}
