import "server-only";

import { listAppointments, listAppointmentTypes } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resolveClassSeriesOfferingKind } from "@/lib/appointments/class-series-offering";

export type AppointmentDomainType = "service" | "meeting" | "class" | "workshop" | "registration";

export type AppointmentDirectoryRow = {
  id: string;
  inviteeName: string | null;
  inviteePhone: string | null;
  inviteeEmail: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  timezone: string | null;
  reminderStatus: string | null;
  contactId: string | null;
  domainType: AppointmentDomainType;
  domainLabel: string;
  staffLabel: string;
  staffIds: string[];
  locationId: string | null;
  locationLabel: string | null;
  resourceLabels: string[];
  paymentLabel: string | null;
  balanceDueCents: number;
  attentionFlags: string[];
  attentionSummary: string | null;
  metadata: Record<string, unknown>;
  contact?: { id: string } | null;
};

export type AppointmentsListFilters = {
  tab?: string;
  q?: string;
  from?: Date;
  to?: Date;
  status?: string;
  staffIds?: string[];
  locationId?: string;
  resourceId?: string;
  domainType?: string;
  payment?: string;
  attention?: boolean;
  take?: number;
  skip?: number;
};

function inferDomain(
  meta: AppointmentMetadata,
  serviceName: string | null,
  kindByName: Map<string, string>,
): AppointmentDomainType {
  if ((meta as { classOccurrenceId?: string }).classOccurrenceId || meta.classSessionId) return "class";
  if ((meta as { workshopId?: string }).workshopId) return "workshop";
  const kind = (meta as { bookingTypeKind?: string }).bookingTypeKind || kindByName.get(serviceName || "");
  if (kind === "MEETING") return "meeting";
  if (kind === "CLASS") return "class";
  return "service";
}

function domainLabel(t: AppointmentDomainType): string {
  if (t === "meeting") return "Meeting";
  if (t === "class") return "Class";
  if (t === "workshop") return "Workshop";
  if (t === "registration") return "Registration";
  return "Service";
}

function paymentInfo(meta: AppointmentMetadata) {
  const due = meta.balanceDueCents ?? meta.amountDueCents ?? 0;
  if (due > 0) return { cents: due, label: `$${(due / 100).toFixed(0)} due` };
  if (meta.paymentStatus === "paid") return { cents: 0, label: "Paid" };
  if (meta.depositPaidCents) return { cents: 0, label: "Deposit paid" };
  if ((meta as { packageId?: string }).packageId) return { cents: 0, label: "Package" };
  return { cents: 0, label: null };
}

function staffIdsFromMeta(
  meta: AppointmentMetadata,
  staffName: string | null,
  staff: Array<{ id: string; name: string }>,
) {
  const ids = new Set<string>();
  if (meta.staffId) ids.add(meta.staffId);
  if (meta.primaryStaffId) ids.add(meta.primaryStaffId);
  for (const id of meta.teamStaffIds || []) ids.add(id);
  if (!ids.size && staffName) {
    const m = staff.find((s) => s.name === staffName);
    if (m) ids.add(m.id);
  }
  return [...ids];
}

function staffLabel(
  meta: AppointmentMetadata,
  staffName: string | null,
  staff: Array<{ id: string; name: string }>,
) {
  const ids = staffIdsFromMeta(meta, staffName, staff);
  if (ids.length > 1) {
    const names = ids.map((id) => staff.find((s) => s.id === id)?.name).filter(Boolean);
    return names.length ? names.join(" + ") : `${ids.length} staff`;
  }
  return staffName || staff.find((s) => s.id === ids[0])?.name || "—";
}

function locationLabel(meta: AppointmentMetadata, locations: Array<{ id: string; name: string }>) {
  if (meta.locationId) return locations.find((l) => l.id === meta.locationId)?.name || meta.location || null;
  return meta.location || null;
}

function attentionFrom(meta: AppointmentMetadata, payCents: number): { flags: string[]; summary: string | null } {
  const flags: string[] = [];
  if (payCents > 0) flags.push("payment_due");
  if ((meta as { pendingApproval?: boolean }).pendingApproval) flags.push("unconfirmed");
  const summary =
    flags.includes("payment_due") && flags.includes("unconfirmed")
      ? "Payment due · Unconfirmed"
      : flags.includes("payment_due")
        ? "Payment due"
        : flags.includes("unconfirmed")
          ? "Awaiting confirmation"
          : null;
  return { flags, summary };
}

function tabToRange(tab: string | undefined, now: Date): { from?: Date; to?: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (tab === "today") return { from: start, to: end };
  if (tab === "upcoming") return { from: now };
  if (tab === "past") return { to: now };
  if (tab === "cancelled" || tab === "canceled") return {};
  return {};
}

export async function buildAppointmentsDirectory(workspaceId: string, filters: AppointmentsListFilters) {
  const now = new Date();
  if (filters.tab === "attention") filters.attention = true;
  const tabRange = tabToRange(filters.tab, now);
  const from = filters.from ?? tabRange.from;
  const to = filters.to ?? tabRange.to;

  const [platform, types, appointments] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    listAppointmentTypes(workspaceId),
    listAppointments(workspaceId, {
      from,
      to,
      status: filters.status && filters.status !== "all" ? filters.status : undefined,
      q: filters.q,
      take: filters.take ?? 200,
    }),
  ]);

  const staff = (platform.staff || []).map((s) => ({ id: s.id, name: s.name }));
  const locations = (platform.locations || []).map((l) => ({ id: l.id, name: l.name }));
  const kindByName = new Map(types.map((t) => [t.name, (t.config?.bookingTypeKind as string) || "SERVICE"]));

  const prisma = getPrisma();
  const apptIds = appointments.map((a) => a.id);
  const lines =
    apptIds.length > 0
      ? await prisma.appointmentServiceLine.findMany({
          where: { workspaceId, appointmentId: { in: apptIds } },
          select: { appointmentId: true, resourceIds: true },
        })
      : [];
  const resourceIdsByAppt = new Map<string, string[]>();
  for (const line of lines) {
    const prev = resourceIdsByAppt.get(line.appointmentId) || [];
    resourceIdsByAppt.set(line.appointmentId, [...new Set([...prev, ...line.resourceIds])]);
  }
  const allResourceIds = [...new Set(lines.flatMap((l) => l.resourceIds))];
  const resourceRows =
    allResourceIds.length > 0
      ? await prisma.schedulingResource.findMany({
          where: { workspaceId, id: { in: allResourceIds } },
          select: { id: true, name: true },
        })
      : [];
  const resourceNameById = new Map(resourceRows.map((r) => [r.id, r.name]));

  let rows: AppointmentDirectoryRow[] = appointments.map((row) => {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const domainType = inferDomain(meta, row.serviceName, kindByName);
    const pay = paymentInfo(meta);
    const attn = attentionFrom(meta, pay.cents);
    const labels =
      (meta as { resourceLabels?: Array<{ name: string }> }).resourceLabels?.map((x) => x.name) ||
      (resourceIdsByAppt.get(row.id) || []).map((id) => resourceNameById.get(id) || id);
    const staffIds = staffIdsFromMeta(meta, row.staffName, staff);
    return {
      id: row.id,
      inviteeName: row.inviteeName,
      inviteePhone: row.inviteePhone,
      inviteeEmail: row.inviteeEmail,
      serviceName: row.serviceName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      timezone: row.timezone,
      reminderStatus: row.reminderStatus,
      contactId: row.contactId,
      domainType,
      domainLabel: domainLabel(domainType),
      staffLabel: staffLabel(meta, row.staffName, staff),
      staffIds,
      locationId: meta.locationId || null,
      locationLabel: locationLabel(meta, locations),
      resourceLabels: labels,
      paymentLabel: pay.label,
      balanceDueCents: pay.cents,
      attentionFlags: attn.flags,
      attentionSummary: attn.summary,
      metadata: {
        ...(row.metadata as object),
        staffName: row.staffName || meta.staffName,
        resourceIds: resourceIdsByAppt.get(row.id) || [],
      },
      contact: row.contactId ? { id: row.contactId } : row.contact ? { id: row.contact.id } : null,
    };
  });

  if (filters.tab === "cancelled" || filters.tab === "canceled") {
    rows = rows.filter((r) => ["canceled", "cancelled"].includes(r.status.toLowerCase()));
  } else if (filters.tab && !["all", "today", "upcoming", "past", "attention"].includes(filters.tab)) {
    rows = rows.filter((r) => r.status.toLowerCase() === filters.tab);
  }

  if (from && filters.tab === "upcoming") {
    rows = rows.filter((r) => new Date(r.startsAt) >= from);
  }
  if (to && filters.tab === "past") {
    rows = rows.filter((r) => new Date(r.startsAt) <= to);
  }

  const enrollmentTo = to ?? new Date((from ?? now).getTime() + 90 * 24 * 60 * 60 * 1000);
  const enrollmentFrom = from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (enrollmentFrom && enrollmentTo) {
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        workspaceId,
        status: "enrolled",
        occurrence: { startsAt: { gte: enrollmentFrom, lte: enrollmentTo } },
      },
      include: {
        occurrence: { include: { series: true } },
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
      take: 100,
    });
    for (const en of enrollments) {
      if (!en.occurrence) continue;
      const series = en.occurrence.series;
      const kind = resolveClassSeriesOfferingKind(series.metadata);
      const domainType = kind === "workshop" ? "workshop" : "class";
      const name =
        `${en.contact?.firstName || ""} ${en.contact?.lastName || ""}`.trim() || "Client";
      rows.push({
        id: `enroll:${en.id}`,
        inviteeName: name,
        inviteePhone: en.contact?.phone ?? null,
        inviteeEmail: en.contact?.email ?? null,
        serviceName: series.name,
        startsAt: en.occurrence.startsAt.toISOString(),
        endsAt: en.occurrence.endsAt.toISOString(),
        status: "confirmed",
        timezone: platform.timezone,
        reminderStatus: null,
        contactId: en.contactId,
        domainType: "registration",
        domainLabel: kind === "workshop" ? "Workshop registration" : "Class registration",
        staffLabel: series.staffId ? staff.find((s) => s.id === series.staffId)?.name || "—" : "—",
        staffIds: series.staffId ? [series.staffId] : [],
        locationId: series.locationId,
        locationLabel: series.locationId ? locations.find((l) => l.id === series.locationId)?.name || null : null,
        resourceLabels: [],
        paymentLabel: null,
        balanceDueCents: 0,
        attentionFlags: [],
        attentionSummary: null,
        metadata: { enrollmentId: en.id, occurrenceId: en.occurrenceId, seriesId: series.id },
        contact: { id: en.contactId },
      });
    }
  }

  if (filters.staffIds?.length) {
    const wanted = new Set(filters.staffIds);
    rows = rows.filter((r) => r.staffIds.some((id) => wanted.has(id)));
  }
  if (filters.locationId) rows = rows.filter((r) => r.locationId === filters.locationId);
  if (filters.resourceId) {
    rows = rows.filter((r) => {
      const ids = (r.metadata.resourceIds as string[]) || [];
      return ids.includes(filters.resourceId!);
    });
  }
  if (filters.domainType && filters.domainType !== "all") {
    rows = rows.filter((r) => r.domainType === filters.domainType || (filters.domainType === "class" && r.domainType === "registration" && r.domainLabel.includes("Class")));
  }
  if (filters.payment === "due") rows = rows.filter((r) => r.balanceDueCents > 0);
  if (filters.attention) rows = rows.filter((r) => r.attentionFlags.length > 0);

  rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const summary = computeSummary(rows, now);

  return {
    rows,
    summary,
    filters: {
      staff,
      locations,
      resources: await prisma.schedulingResource.findMany({
        where: { workspaceId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      services: types.map((t) => ({ id: t.id, name: t.name })),
    },
  };
}

function computeSummary(rows: AppointmentDirectoryRow[], now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let today = 0;
  let upcoming = 0;
  let attention = 0;
  let unpaid = 0;
  for (const r of rows) {
    const t = new Date(r.startsAt).getTime();
    if (t >= start.getTime() && t <= end.getTime() && !["canceled", "cancelled"].includes(r.status)) today++;
    if (t >= now.getTime() && !["canceled", "cancelled", "completed", "no_show"].includes(r.status)) upcoming++;
    if (r.attentionFlags.length) attention++;
    if (r.balanceDueCents > 0) unpaid++;
  }
  return { today, upcoming, attention, unpaid, formsDue: 0, noShowsToday: 0, total: rows.length };
}

export async function buildAppointmentsListWorkspace(workspaceId: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const types = await listAppointmentTypes(workspaceId);
  return {
    staff: (platform.staff || []).filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name })),
    locations: (platform.locations || []).map((l) => ({ id: l.id, name: l.name })),
    services: types.map((t) => ({ id: t.id, name: t.name })),
    timezone: platform.timezone,
  };
}
