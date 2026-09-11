import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { countResourceUsage, listSchedulingResources } from "@/lib/appointments/service-booking/resources";
import { areResourcesAvailableForSlot } from "@/lib/appointments/service-booking/resource-availability";
import { listResourceGroups } from "@/lib/appointments/service-booking/resource-pools";
import { getPrisma } from "@/lib/db";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";

export type ResourceDirectoryRow = {
  id: string;
  name: string;
  typeLabel: string;
  locationLabel: string;
  quantity: number;
  usedByCount: number;
  availabilityLabel: string;
  status: "active" | "inactive" | "needs_setup";
  statusLabel: string;
  inUseNow: number;
};

function typeLabelFromMeta(metadata: Record<string, unknown> | null | undefined): string {
  const cat = metadata?.category || metadata?.type;
  if (typeof cat === "string" && cat.trim()) return cat;
  return "Resource";
}

function locationLabel(
  metadata: Record<string, unknown> | null | undefined,
  platformLocations: Array<{ id: string; name: string }>,
): string {
  const ids = (metadata?.locationIds as string[]) || [];
  if (!ids.length) return "All locations";
  const names = ids.map((id) => platformLocations.find((l) => l.id === id)?.name || id);
  return names.join(", ");
}

export async function buildResourcesWorkspace(workspaceId: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const [resources, groups, types] = await Promise.all([
    listSchedulingResources(workspaceId),
    listResourceGroups(workspaceId),
    getPrisma().voiceService.findMany({ where: { workspaceId }, select: { id: true, name: true, config: true } }),
  ]);

  const locs = (platform.locations || []).map((l) => ({ id: l.id, name: l.name }));
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const directory: ResourceDirectoryRow[] = [];
  for (const r of resources) {
    const meta = (r.metadata || {}) as Record<string, unknown>;
    const eligible = r.eligibleTypeIds || [];
    const usedBy =
      eligible.length > 0
        ? eligible.length
        : types.filter((t) => {
            const cfg = (t.config || {}) as AppointmentTypeConfig;
            return (cfg.resourceIds || []).includes(r.id);
          }).length;

    let inUseNow = 0;
    try {
      inUseNow = await countResourceUsage(workspaceId, r.id, now, windowEnd);
    } catch {
      inUseNow = 0;
    }
    const qty = r.quantity ?? 1;
    const avail =
      !r.active
        ? "Inactive"
        : inUseNow >= qty
          ? "In use"
          : qty > 1
            ? `${qty - inUseNow} / ${qty} available`
            : "Available";

    const st = !r.name?.trim() ? "needs_setup" : r.active ? "active" : "inactive";
    directory.push({
      id: r.id,
      name: r.name,
      typeLabel: typeLabelFromMeta(meta),
      locationLabel: locationLabel(meta, locs),
      quantity: qty,
      usedByCount: usedBy,
      availabilityLabel: avail,
      status: st,
      statusLabel: st === "inactive" ? "Inactive" : st === "needs_setup" ? "Needs setup" : "Active",
      inUseNow,
    });
  }

  const summary = {
    total: directory.length,
    active: directory.filter((d) => d.status === "active").length,
    pools: groups.filter((g) => g.active).length,
    locations: locs.length,
    servicesUsing: types.filter((t) => {
      const cfg = (t.config || {}) as AppointmentTypeConfig;
      return (cfg.resourceIds || []).length > 0;
    }).length,
    needsAttention: directory.filter((d) => d.status === "needs_setup").length,
  };

  return {
    directory,
    summary,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      resourceIds: g.resourceIds,
      selectionMode: g.selectionMode,
      active: g.active,
    })),
    locations: locs,
    types: types.map((t) => ({ id: t.id, name: t.name })),
  };
}

export type ResourceDetailPayload = {
  resource: {
    id: string;
    name: string;
    quantity: number;
    description: string | null;
    active: boolean;
    eligibleTypeIds: string[];
    category: string;
    locationIds: string[];
  };
  typeLabel: string;
  locationLabel: string;
  setupHealth: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  services: Array<{
    id: string;
    name: string;
    assigned: boolean;
    durationMinutes: number;
  }>;
  groups: Array<{ id: string; name: string; member: boolean }>;
  scheduling: {
    mode: string;
    summary: string;
  };
  bookings: Array<{
    id: string;
    appointmentId: string;
    startsAt: string;
    endsAt: string;
    serviceName: string;
    status: string;
  }>;
  capacityNow: { quantity: number; inUse: number; available: number };
  futureReservationCount: number;
};

export async function buildResourceDetail(
  workspaceId: string,
  resourceId: string,
): Promise<ResourceDetailPayload | null> {
  const prisma = getPrisma();
  const resource = await prisma.schedulingResource.findFirst({
    where: { id: resourceId, workspaceId },
  });
  if (!resource) return null;

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const locs = (platform.locations || []).map((l) => ({ id: l.id, name: l.name }));
  const meta = (resource.metadata || {}) as Record<string, unknown>;
  const locationIds = (meta.locationIds as string[]) || [];
  const category = String(meta.category || meta.type || "Resource");

  const types = await prisma.voiceService.findMany({
    where: { workspaceId },
    select: { id: true, name: true, config: true, durationMinutes: true },
  });

  const eligible = new Set(resource.eligibleTypeIds || []);
  const services = types.map((t: { id: string; name: string; config: unknown; durationMinutes: number | null }) => {
    const cfg = (t.config || {}) as AppointmentTypeConfig;
    const assigned =
      eligible.size > 0
        ? eligible.has(t.id)
        : (cfg.resourceIds || []).includes(resource.id);
    return {
      id: t.id,
      name: t.name,
      assigned,
      durationMinutes: t.durationMinutes || 30,
    };
  });

  const groups = await listResourceGroups(workspaceId);
  const groupRows = groups.map((g: { id: string; name: string; resourceIds: string[] }) => ({
    id: g.id,
    name: g.name,
    member: g.resourceIds.includes(resource.id),
  }));

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inUse = await countResourceUsage(workspaceId, resource.id, now, horizon).catch(() => 0);
  const qty = resource.quantity ?? 1;

  const lines = await prisma.appointmentServiceLine.findMany({
    where: { workspaceId, resourceIds: { has: resource.id } },
    orderBy: { startsAt: "desc" },
    take: 40,
  });

  const futureReservationCount = await prisma.appointmentServiceLine.count({
    where: {
      workspaceId,
      resourceIds: { has: resource.id },
      endsAt: { gt: now },
    },
  });

  const apptIds = [...new Set(lines.map((l: { appointmentId: string }) => l.appointmentId))];
  const appts = apptIds.length
    ? await prisma.voiceAppointment.findMany({
        where: { id: { in: apptIds } },
        select: { id: true, status: true },
      })
    : [];
  const statusByAppt = new Map(appts.map((a: { id: string; status: string }) => [a.id, a.status]));

  const setupHealth = [
    { id: "location", label: "Location", ok: locationIds.length > 0 || locs.length <= 1, detail: locationLabel(meta, locs) },
    { id: "capacity", label: "Capacity", ok: qty >= 1, detail: String(qty) },
    { id: "services", label: "Services", ok: services.some((s) => s.assigned), detail: `${services.filter((s) => s.assigned).length} assigned` },
    { id: "enforcement", label: "Booking enforcement", ok: resource.active, detail: resource.active ? "Active" : "Inactive" },
  ];

  return {
    resource: {
      id: resource.id,
      name: resource.name,
      quantity: qty,
      description: resource.description,
      active: resource.active,
      eligibleTypeIds: resource.eligibleTypeIds || [],
      category,
      locationIds,
    },
    typeLabel: category,
    locationLabel: locationLabel(meta, locs),
    setupHealth,
    services,
    groups: groupRows,
    scheduling: {
      mode: "Uses location hours + capacity reservations",
      summary: "Resource capacity enforced during slot generation and at booking commit.",
    },
    bookings: lines.map((l: {
      id: string;
      appointmentId: string;
      startsAt: Date;
      endsAt: Date;
      serviceName: string;
    }) => ({
      id: l.id,
      appointmentId: l.appointmentId,
      startsAt: l.startsAt.toISOString(),
      endsAt: l.endsAt.toISOString(),
      serviceName: l.serviceName,
      status: statusByAppt.get(l.appointmentId) || "—",
    })),
    capacityNow: { quantity: qty, inUse, available: Math.max(0, qty - inUse) },
    futureReservationCount,
  };
}

export async function testResourceAvailability(
  workspaceId: string,
  input: {
    resourceId: string;
    startsAt: string;
    endsAt: string;
    serviceId?: string;
  },
) {
  const prisma = getPrisma();
  const resource = await prisma.schedulingResource.findFirst({
    where: { id: input.resourceId, workspaceId },
  });
  if (!resource) throw new Error("Resource not found");

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const used = await countResourceUsage(workspaceId, input.resourceId, startsAt, endsAt);
  const qty = resource.quantity ?? 1;
  const available = Math.max(0, qty - used);
  const ok = await areResourcesAvailableForSlot(workspaceId, [input.resourceId], startsAt, endsAt);

  let serviceName: string | null = null;
  if (input.serviceId) {
    const svc = await prisma.voiceService.findFirst({ where: { id: input.serviceId, workspaceId } });
    serviceName = svc?.name || null;
  }

  return {
    resourceName: resource.name,
    serviceName,
    capacity: qty,
    reserved: used,
    available,
    result: ok ? "Available" : "Unavailable",
  };
}
