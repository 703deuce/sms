import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";
import type { AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";
import {
  buildStaffRows,
  resolveStaffAvailabilitySource,
  staffInitials,
  type StaffAvailabilityRow,
} from "@/lib/appointments/availability/availability-workspace";
import { DAY_LABELS, defaultWeeklyHours } from "@/features/appointments/kimi/availability/map-availability";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";
import { listWorkspaceCalendarConnections } from "@/lib/calendar/connections";
import { decodeRoutingPolicy, routingMethodLabel } from "@/lib/appointments/routing/routing-model";

export type StaffDirectoryRow = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  title: string | null;
  email: string | null;
  serviceCount: number;
  locationLabels: string;
  availabilityLabel: string;
  availabilityStatus: StaffAvailabilityRow["status"];
  calendarLabel: string;
  calendarConnected: boolean;
  publicLabel: string;
  status: "active" | "inactive" | "needs_setup";
  statusLabel: string;
  bookable: boolean;
};

export type StaffDetailPayload = {
  member: BookableStaffMember;
  availability: StaffAvailabilityRow;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    assigned: boolean;
    routingLabel: string;
    teamBooking: boolean;
    locationCount: number;
  }>;
  locations: Array<{
    id: string;
    name: string;
    kind?: string;
    assigned: boolean;
    serviceCountAtLocation: number;
  }>;
  scheduling: {
    sourceLabel: string;
    weeklySummary: string[];
    upcomingOverrides: Array<{ date: string; label: string }>;
    calendarLabel: string;
    calendarConnected: boolean;
    calendarManageHref: string;
    availabilityHref: string;
  };
  setupIssues: Array<{ id: string; message: string; href: string }>;
  routingSummary: { eligibleServices: number; href: string };
  teamBookingSummary: { serviceCount: number; href: string };
  bookingStats: { upcoming: number; today: number; last30Days: number };
  appointments: Array<{
    id: string;
    startsAt: string;
    endsAt: string | null;
    customerName: string;
    serviceName: string;
    locationName: string | null;
    status: string;
    role: string;
  }>;
  futureAppointmentCount: number;
};

function platformAvailabilityForm(platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>): AvailabilityFormState {
  return {
    weeklyHours: platform.weeklyHours || defaultWeeklyHours(),
    dateOverrides: platform.dateOverrides || [],
    namedSchedules: platform.namedSchedules || [],
    timezone: platform.timezone || "America/New_York",
    minimumNotice: 0,
    maximumDays: 60,
    holidays: [],
    overrideDate: "",
    overrideClosed: false,
    overrideOpen: "09:00",
    overrideClose: "17:00",
    blackoutDates: [],
    fixedStartTimesEnabled: false,
    fixedStartTimes: "",
    minimizeGapsMode: "off",
  };
}

function publicVisibilityLabel(member: BookableStaffMember): string {
  if (member.active === false) return "Inactive";
  if (member.customerSelectable === false) return "Auto-assignment only";
  return "Visible";
}

function countFutureAppointmentsForStaff(
  rows: Array<{ startsAt: Date; metadata: unknown }>,
  staffId: string,
  now: Date,
): number {
  return rows.filter((row) => {
    if (row.startsAt <= now) return false;
    const meta = row.metadata as { staffId?: string; teamStaffIds?: string[] } | null;
    if (meta?.staffId === staffId) return true;
    return Array.isArray(meta?.teamStaffIds) && meta.teamStaffIds.includes(staffId);
  }).length;
}

export async function buildStaffWorkspace(workspaceId: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const prisma = getPrisma();
  type ServiceRow = { id: string; name: string; durationMinutes: number | null; config: unknown };
  type ApptRow = {
    startsAt: Date;
    endsAt: Date | null;
    metadata: unknown;
    status: string;
    serviceName: string | null;
    staffName: string | null;
  };
  const [types, connections, apptRows] = await Promise.all([
    prisma.voiceService.findMany({
      where: { workspaceId },
      select: { id: true, name: true, durationMinutes: true, config: true },
    }) as Promise<ServiceRow[]>,
    listWorkspaceCalendarConnections(workspaceId),
    prisma.voiceAppointment.findMany({
      where: { workspaceId },
      select: { startsAt: true, endsAt: true, metadata: true, status: true, serviceName: true, staffName: true },
      orderBy: { startsAt: "desc" },
      take: 500,
    }) as Promise<ApptRow[]>,
  ]);

  const form = platformAvailabilityForm(platform);
  const calendarByConnectionId = new Map<string, { label: string; connected: boolean }>();
  for (const c of connections) {
    calendarByConnectionId.set(c.id, {
      label: `${c.provider === "google" ? "Google" : c.provider === "microsoft" ? "Microsoft" : c.provider}`,
      connected: c.status === "connected" || c.status === "active",
    });
  }

  const staff = platform.staff || [];
  const rows = buildStaffRows(staff, form, calendarByConnectionId);
  const locationById = new Map((platform.locations || []).map((l) => [l.id, l.name]));

  const directory: StaffDirectoryRow[] = rows.map((r) => {
    const member = r.member;
    const locIds = member.locationIds || [];
    const locationLabels =
      locIds.length === 0
        ? "—"
        : locIds.length === 1
          ? locationById.get(locIds[0]) || "1 location"
          : `${locationById.get(locIds[0]) || "Location"} + ${locIds.length - 1}`;
    const inactive = member.active === false;
    const needsSetup = r.status !== "ready" && !inactive;
    return {
      id: r.id,
      name: member.publicDisplayName || member.name,
      initials: r.initials,
      avatarUrl: member.avatarUrl || null,
      title: member.title || member.role || null,
      email: member.email || null,
      serviceCount: r.serviceCount,
      locationLabels,
      availabilityLabel: r.sourceLabel,
      availabilityStatus: r.status,
      calendarLabel: r.calendarLabel,
      calendarConnected: r.calendarConnected,
      publicLabel: publicVisibilityLabel(member),
      status: inactive ? "inactive" : needsSetup ? "needs_setup" : "active",
      statusLabel: inactive ? "Inactive" : needsSetup ? "Needs setup" : "Active",
      bookable: !inactive && r.status === "ready",
    };
  });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const summary = {
    activeStaff: staff.filter((s) => s.active !== false).length,
    bookable: directory.filter((d) => d.bookable).length,
    needsSetup: directory.filter((d) => d.status === "needs_setup").length,
    calendarConnected: directory.filter((d) => d.calendarConnected).length,
    calendarTotal: directory.filter((d) => d.status !== "inactive").length,
    locations: (platform.locations || []).filter((l) => l.active !== false).length,
  };

  return { directory, summary, staff, types, locations: platform.locations || [] };
}

export async function buildStaffDetail(workspaceId: string, staffId: string): Promise<StaffDetailPayload | null> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const member = (platform.staff || []).find((s) => s.id === staffId);
  if (!member) return null;

  const prisma = getPrisma();
  type ServiceRow = { id: string; name: string; durationMinutes: number | null; config: unknown };
  type ApptDetailRow = {
    id: string;
    startsAt: Date;
    endsAt: Date | null;
    metadata: unknown;
    status: string;
    serviceName: string | null;
    staffName: string | null;
  };
  const [types, connections, apptRows] = await Promise.all([
    prisma.voiceService.findMany({
      where: { workspaceId },
      select: { id: true, name: true, durationMinutes: true, config: true },
    }) as Promise<ServiceRow[]>,
    listWorkspaceCalendarConnections(workspaceId),
    prisma.voiceAppointment.findMany({
      where: { workspaceId },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        metadata: true,
        status: true,
        serviceName: true,
        staffName: true,
      },
      orderBy: { startsAt: "desc" },
      take: 200,
    }) as Promise<ApptDetailRow[]>,
  ]);

  const form = platformAvailabilityForm(platform);
  const calendarByConnectionId = new Map<string, { label: string; connected: boolean }>();
  for (const c of connections) {
    calendarByConnectionId.set(c.id, {
      label: `${c.provider === "google" ? "Google" : c.provider === "microsoft" ? "Microsoft" : c.provider}`,
      connected: c.status === "connected" || c.status === "active",
    });
  }
  const availability =
    buildStaffRows([member], form, calendarByConnectionId)[0] ||
    ({
      id: member.id,
      name: member.name,
      initials: staffInitials(member.name),
      source: "business_default",
      sourceLabel: "Business default",
      scheduleSummary: "",
      serviceCount: 0,
      locationCount: 0,
      calendarLabel: "Not connected",
      calendarConnected: false,
      status: "setup_issue",
      statusLabel: "Setup issue",
      member,
    } as StaffAvailabilityRow);

  const assignedTypeIds = new Set(member.appointmentTypeIds || []);
  const services = types.map((t) => {
    const cfg = (t.config || {}) as AppointmentTypeConfig;
    const inPool = (cfg.staffIds || []).includes(staffId);
    const assigned = assignedTypeIds.has(t.id) || inPool;
    const decoded = decodeRoutingPolicy(cfg, platform.staffRouting || {});
    const team = Boolean(cfg.teamBooking?.enabled || cfg.staffAssignment === "collective");
    return {
      id: t.id,
      name: t.name,
      durationMinutes: t.durationMinutes || 30,
      assigned,
      routingLabel: routingMethodLabel(decoded.autoMethod || decoded.staffAssignment),
      teamBooking: team,
      locationCount: (cfg.locationIds || []).length,
    };
  });

  const locIds = new Set(member.locationIds || []);
  const locations = (platform.locations || []).map((loc) => {
    const assigned = locIds.has(loc.id) || (loc.staffIds || []).includes(staffId);
    const serviceCountAtLocation = types.filter((t) => {
      const cfg = (t.config || {}) as AppointmentTypeConfig;
      const locs = cfg.locationIds || [];
      return !locs.length || locs.includes(loc.id);
    }).length;
    return {
      id: loc.id,
      name: loc.name,
      kind: loc.kind,
      assigned,
      serviceCountAtLocation,
    };
  });

  const weekly =
    member.weeklyHours && Object.keys(member.weeklyHours).length ? member.weeklyHours : form.weeklyHours;
  const weeklySummary = DAY_LABELS.map(({ key, label }) => {
    const windows = weekly[key] || [];
    if (!windows.length) return `${label}: Off`;
    const range = windows.map((w) => `${w.open}–${w.close}`).join(", ");
    return `${label}: ${range}`;
  });

  const upcomingOverrides = (member.dateOverrides || form.dateOverrides || [])
    .filter((o) => o.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 5)
    .map((o) => ({
      date: o.date,
      label: o.closed ? "Unavailable" : o.windows?.map((w) => `${w.open}–${w.close}`).join(", ") || "Custom",
    }));

  const { label: sourceLabel } = resolveStaffAvailabilitySource(member, form);
  const conn = member.calendarConnectionId
    ? calendarByConnectionId.get(member.calendarConnectionId)
    : undefined;

  const setupIssues: StaffDetailPayload["setupIssues"] = [];
  if (availability.status === "no_schedule") {
    setupIssues.push({ id: "availability", message: "No working hours configured", href: `/appointments/availability?staffId=${staffId}` });
  }
  if (availability.status === "no_services") {
    setupIssues.push({ id: "services", message: "No services assigned", href: `/appointments/staff/${staffId}?section=services` });
  }
  if (availability.status === "no_location") {
    setupIssues.push({ id: "locations", message: "No locations assigned", href: `/appointments/staff/${staffId}?section=locations` });
  }

  const routingEligible = services.filter((s) => s.assigned && s.routingLabel !== "—").length;
  const teamCount = services.filter((s) => s.assigned && s.teamBooking).length;

  const now = new Date();
  const staffAppts = apptRows.filter((row) => {
    const meta = row.metadata as { staffId?: string; teamStaffIds?: string[] } | null;
    if (meta?.staffId === staffId) return true;
    return Array.isArray(meta?.teamStaffIds) && meta.teamStaffIds.includes(staffId);
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const upcoming = staffAppts.filter(
    (a) => a.startsAt > now && !["cancelled", "canceled"].includes(String(a.status)),
  ).length;
  const today = staffAppts.filter((a) => a.startsAt >= todayStart && a.startsAt < todayEnd).length;
  const last30 = staffAppts.filter((a) => a.startsAt >= thirtyDaysAgo).length;

  const appointments = staffAppts.slice(0, 50).map((a) => {
    const meta = a.metadata as {
      staffId?: string;
      teamAssignments?: Array<{ staffId: string; role?: string }>;
      location?: string;
      inviteeName?: string;
    } | null;
    let role = "Primary";
    if (meta?.teamAssignments?.length) {
      const hit = meta.teamAssignments.find((t) => t.staffId === staffId);
      role = hit?.role || "Team";
    }
    return {
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt?.toISOString() || null,
      customerName: meta?.inviteeName || "Guest",
      serviceName: a.serviceName || "Appointment",
      locationName: meta?.location || null,
      status: String(a.status),
      role,
    };
  });

  const futureAppointmentCount = countFutureAppointmentsForStaff(
    apptRows.map((r) => ({ startsAt: r.startsAt, metadata: r.metadata })),
    staffId,
    now,
  );

  return {
    member,
    availability,
    services,
    locations,
    scheduling: {
      sourceLabel,
      weeklySummary,
      upcomingOverrides,
      calendarLabel: conn?.label || "Not connected",
      calendarConnected: conn?.connected || false,
      calendarManageHref: "/integrations/calendars",
      availabilityHref: `/appointments/availability?staffId=${staffId}`,
    },
    setupIssues,
    routingSummary: { eligibleServices: routingEligible, href: "/appointments/routing" },
    teamBookingSummary: { serviceCount: teamCount, href: "/appointments/team-booking" },
    bookingStats: { upcoming, today, last30Days: last30 },
    appointments,
    futureAppointmentCount,
  };
}
