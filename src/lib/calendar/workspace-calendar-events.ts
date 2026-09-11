import "server-only";

import { listAppointments } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma, type DbRow } from "@/lib/db";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";
import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resolveClassSeriesOfferingKind } from "@/lib/appointments/class-series-offering";
import type { CalendarListFilters } from "@/lib/appointments/calendar/calendar-workspace";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";

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

function inferDomainType(
  meta: AppointmentMetadata,
  serviceName: string | null,
  serviceKindByName: Map<string, string>,
): CalendarApiAppointment["domainType"] {
  if ((meta as { classOccurrenceId?: string }).classOccurrenceId || meta.classSessionId) {
    return "class";
  }
  if ((meta as { workshopId?: string }).workshopId) return "workshop";
  const kind = (meta as { bookingTypeKind?: string }).bookingTypeKind || serviceKindByName.get(serviceName || "");
  if (kind === "MEETING") return "meeting";
  if (kind === "CLASS") return "class";
  return "service";
}

function paymentLabel(meta: AppointmentMetadata): { cents?: number; label?: string } {
  const due = meta.balanceDueCents ?? meta.amountDueCents;
  if (due && due > 0) {
    return { cents: due, label: `$${(due / 100).toFixed(0)} due` };
  }
  if (meta.paymentStatus === "paid" || meta.depositPaidCents) {
    return { label: "Paid" };
  }
  return {};
}

function staffIdsFromMeta(meta: AppointmentMetadata, staffName?: string | null, platformStaff: Array<{ id: string; name: string }>) {
  const ids = new Set<string>();
  if (meta.staffId) ids.add(meta.staffId);
  if (meta.primaryStaffId) ids.add(meta.primaryStaffId);
  for (const id of meta.teamStaffIds || []) ids.add(id);
  if (!ids.size && staffName) {
    const match = platformStaff.find((s) => s.name === staffName);
    if (match) ids.add(match.id);
  }
  return [...ids];
}

function staffLabel(meta: AppointmentMetadata, staffName: string | null, platformStaff: Array<{ id: string; name: string }>) {
  const ids = staffIdsFromMeta(meta, staffName, platformStaff);
  if (ids.length > 1) {
    const names = ids
      .map((id) => platformStaff.find((s) => s.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(" + ") : `${ids.length} staff`;
  }
  if (staffName) return staffName;
  const one = ids[0] ? platformStaff.find((s) => s.id === ids[0])?.name : null;
  return one || "—";
}

function locationLabel(
  meta: AppointmentMetadata,
  locations: Array<{ id: string; name: string }>,
) {
  if (meta.locationId) {
    return locations.find((l) => l.id === meta.locationId)?.name || meta.location || null;
  }
  return meta.location || null;
}

function applyFilters(rows: CalendarApiAppointment[], filters?: CalendarListFilters) {
  if (!filters) return rows;
  let out = rows;
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        (r.inviteeName || "").toLowerCase().includes(q) ||
        (r.serviceName || "").toLowerCase().includes(q) ||
        (r.staffLabel || "").toLowerCase().includes(q) ||
        (r.locationLabel || "").toLowerCase().includes(q),
    );
  }
  if (filters.status && filters.status !== "all") {
    out = out.filter((r) => {
      const s = r.status.toLowerCase();
      if (filters.status === "canceled") return s === "canceled" || s === "cancelled";
      return s === filters.status;
    });
  }
  if (filters.domainType && filters.domainType !== "all") {
    out = out.filter((r) => r.domainType === filters.domainType);
  }
  if (filters.locationId) {
    out = out.filter((r) => r.locationId === filters.locationId);
  }
  if (filters.resourceId) {
    const rid = filters.resourceId;
    out = out.filter((r) => {
      const ids = (r.metadata?.resourceIds as string[] | undefined) || [];
      return ids.includes(rid);
    });
  }
  if (filters.staffIds?.length) {
    const wanted = new Set(filters.staffIds);
    out = out.filter((r) => (r.staffIds || []).some((id) => wanted.has(id)));
  }
  return out;
}

export async function listWorkspaceCalendarEvents(
  workspaceId: string,
  input: { from?: Date; to?: Date; filters?: CalendarListFilters },
): Promise<CalendarApiAppointment[]> {
  const [appointments, platform, types] = await Promise.all([
    listAppointments(workspaceId, {
      from: input.from,
      to: input.to,
      take: 500,
    }),
    loadAppointmentPlatformConfig(workspaceId),
    listAppointmentTypes(workspaceId),
  ]);

  const platformStaff = (platform.staff || []).map((s) => ({ id: s.id, name: s.name }));
  const locations = (platform.locations || []).map((l) => ({ id: l.id, name: l.name }));
  const serviceKindByName = new Map(
    types.map((t) => [t.name, (t.config?.bookingTypeKind as string) || "SERVICE"]),
  );

  const prisma = getPrisma();
  const apptIds = appointments.map((a) => a.id);
  const resourceLines =
    apptIds.length > 0
      ? await prisma.appointmentServiceLine.findMany({
          where: { workspaceId, appointmentId: { in: apptIds } },
          select: { appointmentId: true, resourceIds: true },
        })
      : [];
  const resourceIdsByAppt = new Map<string, string[]>();
  for (const line of resourceLines) {
    const prev = resourceIdsByAppt.get(line.appointmentId) || [];
    resourceIdsByAppt.set(line.appointmentId, [...new Set([...prev, ...line.resourceIds])]);
  }
  const allResourceIds = [...new Set(resourceLines.flatMap((l) => l.resourceIds))];
  const resourceRows =
    allResourceIds.length > 0
      ? await prisma.schedulingResource.findMany({
          where: { workspaceId, id: { in: allResourceIds } },
          select: { id: true, name: true },
        })
      : [];
  const resourceNameById = new Map(resourceRows.map((r) => [r.id, r.name]));

  const appointmentRows: CalendarApiAppointment[] = appointments.map((row) => {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const domainType = inferDomainType(meta, row.serviceName, serviceKindByName);
    const pay = paymentLabel(meta);
    const labelsFromMeta = (meta as { resourceLabels?: Array<{ name: string }> }).resourceLabels;
    const resourceLabels =
      labelsFromMeta?.map((x) => x.name) ||
      (resourceIdsByAppt.get(row.id) || []).map((id) => resourceNameById.get(id) || id);
    const staffIds = staffIdsFromMeta(meta, row.staffName, platformStaff);
    const attention: string[] = [];
    if (pay.cents && pay.cents > 0) attention.push("payment_due");
    if ((meta as { pendingApproval?: boolean }).pendingApproval) attention.push("unconfirmed");
    return {
      id: row.id,
      eventKind: "appointment",
      domainType,
      inviteeName: row.inviteeName,
      inviteePhone: row.inviteePhone,
      serviceName: row.serviceName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      timezone: row.timezone,
      meeting: (row as DbRow).meeting,
      contactId: row.contactId,
      staffIds,
      staffLabel: staffLabel(meta, row.staffName, platformStaff),
      locationId: meta.locationId || null,
      locationLabel: locationLabel(meta, locations),
      resourceLabels,
      metadata: {
        ...(row.metadata as object),
        resourceIds: resourceIdsByAppt.get(row.id) || [],
      },
      balanceDueCents: pay.cents,
      paymentLabel: pay.label,
      attentionFlags: attention.length ? attention : undefined,
    };
  });

  let combined: CalendarApiAppointment[] = appointmentRows;

  if (input.from && input.to) {
    const occurrences = await prisma.classOccurrence.findMany({
      where: {
        workspaceId,
        startsAt: { gte: input.from, lte: input.to },
        status: { notIn: ["cancelled", "canceled"] },
      },
      include: { series: true },
      orderBy: { startsAt: "asc" },
    });
    const occIds = occurrences.map((o) => o.id);
    const enrollCounts =
      occIds.length > 0
        ? await prisma.classEnrollment.groupBy({
            by: ["occurrenceId"],
            where: { workspaceId, occurrenceId: { in: occIds }, status: "enrolled" },
            _count: { occurrenceId: true },
          })
        : [];
    const countMap = new Map(enrollCounts.map((c) => [c.occurrenceId, c._count.occurrenceId]));

    const classRows: CalendarApiAppointment[] = occurrences.map((occ) => {
      const series = occ.series;
      const kind = resolveClassSeriesOfferingKind(series.metadata);
      const domainType = kind === "workshop" ? "workshop" : "class";
      const enrolled = countMap.get(occ.id) ?? 0;
      const cap = occ.capacity ?? series.capacity;
      const staffIds = series.staffId ? [series.staffId] : [];
      const staffLabel =
        (series.staffId && platformStaff.find((s) => s.id === series.staffId)?.name) || "Instructor";
      const locationLabel =
        (series.locationId && locations.find((l) => l.id === series.locationId)?.name) || null;
      return {
        id: `class:${occ.id}`,
        eventKind: "class_occurrence",
        domainType,
        inviteeName: null,
        serviceName: series.name,
        startsAt: occ.startsAt.toISOString(),
        endsAt: occ.endsAt.toISOString(),
        status: occ.status,
        timezone: platform.timezone,
        metadata: { seriesId: series.id, occurrenceId: occ.id },
        staffIds,
        staffLabel,
        locationId: series.locationId,
        locationLabel,
        registrationSummary: `${enrolled} / ${cap} registered`,
        seriesId: series.id,
        occurrenceId: occ.id,
      };
    });

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
          status: {
            notIn: ["ended", "completed", "processing", "no_recap", "failed", "canceled", "disabled"],
          },
        },
        orderBy: { scheduledStartAt: "asc" },
      }),
    ]);

    const videoRows: CalendarApiAppointment[] = standaloneVideo.map((meeting: DbRow) => ({
      id: `video:${meeting.id}`,
      eventKind: "standalone_video",
      domainType: "video",
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
      domainType: "notetaker",
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

    combined = [...appointmentRows, ...classRows, ...videoRows, ...notetakerRows];
  }

  combined = applyFilters(combined, input.filters);

  return combined.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function publicGuestVideoUrlFromToken(token: string) {
  return publicVideoMeetingUrl(token);
}
