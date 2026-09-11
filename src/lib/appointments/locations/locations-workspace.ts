import "server-only";

import { bookingHoursSummary, resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveLocationWeeklyHours } from "@/lib/appointments/service-booking/location-scheduling";
import { getPrisma } from "@/lib/db";
import type { AppointmentLocation, AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export type LocationDirectoryRow = {
  id: string;
  name: string;
  typeLabel: string;
  addressLabel: string;
  serviceCount: number;
  staffCount: number;
  resourceCount: number;
  availabilityLabel: string;
  status: "active" | "inactive" | "needs_setup";
  statusLabel: string;
};

function kindLabel(kind?: string): string {
  switch (kind) {
    case "video":
    case "transovo_video":
      return "Virtual";
    case "customer":
      return "Customer location";
    case "phone":
      return "Phone";
    case "office":
    case "store":
    case "branch":
      return "Physical";
    default:
      return kind ? "Custom" : "Physical";
  }
}

function addressLabel(loc: AppointmentLocation): string {
  if (loc.kind === "video" || loc.kind === "transovo_video") return "Online / Virtual";
  if (loc.kind === "customer") return "Customer-provided address";
  if (loc.kind === "phone") return "Phone";
  return loc.address?.trim() || "—";
}

function availabilityLabel(loc: AppointmentLocation, platformHasHours: boolean): string {
  if (loc.weeklyHours && Object.keys(loc.weeklyHours).length) return "Configured";
  if (platformHasHours) return "Uses business hours";
  return "No availability";
}

function setupStatus(loc: AppointmentLocation): LocationDirectoryRow["status"] {
  if (loc.active === false) return "inactive";
  if (!loc.name?.trim()) return "needs_setup";
  const physical = !["video", "transovo_video", "customer", "phone"].includes(loc.kind || "");
  if (physical && !loc.address?.trim()) return "needs_setup";
  return "active";
}

export async function buildLocationsWorkspace(workspaceId: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const prisma = getPrisma();
  const [types, resources] = await Promise.all([
    prisma.voiceService.findMany({ where: { workspaceId }, select: { id: true, name: true, config: true } }),
    prisma.schedulingResource.findMany({ where: { workspaceId }, select: { id: true, name: true, locationIds: true } }).catch(() => []),
  ]);

  const platformHours = Boolean(platform.weeklyHours && Object.keys(platform.weeklyHours).length);
  const staff = platform.staff || [];
  const locations = platform.locations || [];

  const directory: LocationDirectoryRow[] = locations.map((loc) => {
    const typeIds = loc.appointmentTypeIds || [];
    const serviceCount =
      typeIds.length > 0
        ? typeIds.length
        : types.filter((t) => {
            const cfg = (t.config || {}) as AppointmentTypeConfig;
            const ids = cfg.locationIds || [];
            return ids.length === 0 || ids.includes(loc.id);
          }).length;

    const staffCount = (loc.staffIds || []).length || staff.filter((s) => (s.locationIds || []).includes(loc.id)).length;
    const resourceCount =
      (loc.resourceIds || []).length ||
      resources.filter((r) => (r.locationIds || []).includes(loc.id)).length;

    const st = setupStatus(loc);
    return {
      id: loc.id,
      name: loc.name || "Unnamed",
      typeLabel: kindLabel(loc.kind),
      addressLabel: addressLabel(loc),
      serviceCount,
      staffCount,
      resourceCount,
      availabilityLabel: availabilityLabel(loc, platformHours),
      status: st,
      statusLabel: st === "inactive" ? "Inactive" : st === "needs_setup" ? "Needs setup" : "Active",
    };
  });

  const summary = {
    total: directory.length,
    active: directory.filter((d) => d.status === "active").length,
    physical: directory.filter((d) => d.typeLabel === "Physical").length,
    virtual: directory.filter((d) => d.typeLabel === "Virtual").length,
    needsSetup: directory.filter((d) => d.status === "needs_setup").length,
  };

  return { directory, summary, locations, staff, types: types.map((t) => ({ id: t.id, name: t.name })) };
}

export type LocationDetailPayload = {
  location: AppointmentLocation;
  typeLabel: string;
  addressLabel: string;
  setupHealth: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    assigned: boolean;
    staffAtLocation: number;
    bookable: boolean;
  }>;
  staff: Array<{
    id: string;
    name: string;
    title: string | null;
    assigned: boolean;
    serviceCount: number;
    status: string;
  }>;
  resources: Array<{ id: string; name: string; linked: boolean }>;
  scheduling: {
    hoursSummary: string[];
    usesCustomHours: boolean;
    timezone: string;
    availabilityHref: string;
    upcomingOverrides: Array<{ date: string; label: string }>;
  };
  customerPreview: {
    title: string;
    lines: string[];
    directionsHint: string | null;
  };
  appointments: Array<{
    id: string;
    startsAt: string;
    clientName: string;
    serviceName: string;
    staffName: string | null;
    status: string;
  }>;
  futureAppointmentCount: number;
  workspaceSlug: string | null;
};

export async function buildLocationDetail(workspaceId: string, locationId: string): Promise<LocationDetailPayload | null> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const loc = (platform.locations || []).find((l) => l.id === locationId);
  if (!loc) return null;

  const prisma = getPrisma();
  const [types, resources, workspace, appts] = await Promise.all([
    prisma.voiceService.findMany({ where: { workspaceId }, select: { id: true, name: true, config: true } }),
    prisma.schedulingResource.findMany({ where: { workspaceId }, select: { id: true, name: true, locationIds: true } }).catch(() => []),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } }),
    prisma.voiceAppointment.findMany({
      where: { workspaceId, startsAt: { gte: new Date(Date.now() - 90 * 86400000) } },
      orderBy: { startsAt: "desc" },
      take: 80,
      select: {
        id: true,
        startsAt: true,
        serviceName: true,
        staffName: true,
        status: true,
        metadata: true,
        contactId: true,
      },
    }),
  ]);

  const staff = platform.staff || [];
  const locStaffIds = new Set(loc.staffIds || staff.filter((s) => (s.locationIds || []).includes(loc.id)).map((s) => s.id));
  const locTypeIds = loc.appointmentTypeIds || [];

  const services = types.map((t) => {
    const cfg = (t.config || {}) as AppointmentTypeConfig;
    const locIds = cfg.locationIds || [];
    const assigned =
      locTypeIds.length > 0
        ? locTypeIds.includes(t.id)
        : locIds.length === 0 || locIds.includes(loc.id);
    const staffAtLocation = (cfg.staffIds || []).filter((id) => locStaffIds.has(id)).length;
    return {
      id: t.id,
      name: t.name,
      durationMinutes: Number(cfg.durationMinutes) || 30,
      assigned,
      staffAtLocation,
      bookable: assigned && loc.active !== false,
    };
  });

  const staffRows = staff.map((s: BookableStaffMember) => {
    const assigned = locStaffIds.has(s.id);
    return {
      id: s.id,
      name: s.name,
      title: s.title || s.role || null,
      assigned,
      serviceCount: (s.appointmentTypeIds || []).length,
      status: s.active === false ? "Inactive" : "Active",
    };
  });

  const locResourceIds = new Set(loc.resourceIds || []);
  const resourceRows = resources.map((r) => ({
    id: r.id,
    name: r.name,
    linked: locResourceIds.size ? locResourceIds.has(r.id) : (r.locationIds || []).includes(loc.id),
  }));

  const weekly = resolveLocationWeeklyHours(platform, loc.id);
  const usesCustom = Boolean(loc.weeklyHours && Object.keys(loc.weeklyHours).length);
  const hoursSummary = bookingHoursSummary(weekly).split("\n").slice(0, 7);

  const relatedAppts = appts.filter((a) => {
    const meta = (a.metadata || {}) as AppointmentMetadata & { locationId?: string };
    return meta.locationId === loc.id || meta.location === loc.name;
  });

  const futureCount = await prisma.voiceAppointment.count({
    where: {
      workspaceId,
      startsAt: { gt: new Date() },
      OR: [
        { metadata: { path: ["locationId"], equals: loc.id } },
        { metadata: { path: ["location"], equals: loc.name } },
      ],
    },
  });

  const setupHealth = [
    { id: "address", label: "Address / method", ok: addressLabel(loc) !== "—", detail: addressLabel(loc) },
    { id: "services", label: "Services", ok: services.some((s) => s.assigned), detail: `${services.filter((s) => s.assigned).length} assigned` },
    { id: "staff", label: "Staff", ok: staffRows.some((s) => s.assigned), detail: `${staffRows.filter((s) => s.assigned).length} assigned` },
    { id: "availability", label: "Availability", ok: usesCustom || Boolean(platform.weeklyHours), detail: availabilityLabel(loc, Boolean(platform.weeklyHours)) },
    { id: "resources", label: "Resources", ok: resourceRows.some((r) => r.linked), detail: `${resourceRows.filter((r) => r.linked).length} linked` },
    { id: "public", label: "Public booking", ok: loc.active !== false, detail: loc.active === false ? "Hidden" : "Visible" },
  ];

  const previewLines: string[] = [];
  if (loc.kind === "video" || loc.kind === "transovo_video") {
    previewLines.push("You'll receive your meeting link after booking.");
  } else if (loc.kind === "customer") {
    previewLines.push("We'll come to the address you provide during booking.");
  } else {
    if (loc.address) previewLines.push(loc.address);
  }

  return {
    location: loc,
    typeLabel: kindLabel(loc.kind),
    addressLabel: addressLabel(loc),
    setupHealth,
    services,
    staff: staffRows,
    resources: resourceRows,
    scheduling: {
      hoursSummary,
      usesCustomHours: usesCustom,
      timezone: loc.timezone || platform.timezone || "America/New_York",
      availabilityHref: "/appointments/availability",
      upcomingOverrides: (platform.dateOverrides || [])
        .slice(0, 5)
        .map((o) => ({ date: o.date, label: o.closed ? "Closed" : `${o.open || ""}-${o.close || ""}` })),
    },
    customerPreview: {
      title: loc.name,
      lines: previewLines,
      directionsHint: loc.address && loc.kind !== "customer" ? "Get directions" : null,
    },
    appointments: relatedAppts.slice(0, 30).map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      clientName: "Client",
      serviceName: a.serviceName || "Appointment",
      staffName: a.staffName,
      status: a.status,
    })),
    futureAppointmentCount: futureCount,
    workspaceSlug: workspace?.slug || null,
  };
}
