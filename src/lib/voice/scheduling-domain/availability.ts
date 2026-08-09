import { getPrisma } from "@/lib/db";
import type {
  AvailabilityQuery,
  AvailabilityResult,
  ResourceResolution,
  SchedulingResource,
  SchedulingService,
  SchedulingSlot,
} from "./types";

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function staffToResource(row: {
  id: string;
  name: string;
  config?: unknown;
}): SchedulingResource {
  const config = (row.config || {}) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    skills: parseJsonArray(config.skills),
    zones: parseJsonArray(config.zones || config.serviceZones),
    businessHours: (config.businessHours as SchedulingResource["businessHours"]) || null,
    calendarConnected: Boolean(config.calendarConnected),
    metadata: config,
  };
}

function serviceToSchedulingService(row: {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes?: number | null;
  config?: unknown;
}): SchedulingService {
  const config = (row.config || {}) as Record<string, unknown>;
  const staffIds = parseJsonArray(config.staffIds);
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    bufferMinutes: row.bufferMinutes || 0,
    requiredSkills: parseJsonArray(config.requiredSkills),
    eligibleResourceIds: staffIds,
    bookingPolicy: (config.bookingPermission as string) || null,
    metadata: config,
  };
}

export async function loadServiceByName(
  workspaceId: string,
  serviceName: string,
): Promise<SchedulingService | null> {
  const prisma = getPrisma();
  const row = await prisma.voiceService.findFirst({
    where: { workspaceId, name: { equals: serviceName, mode: "insensitive" } },
  });
  if (!row) return null;
  return serviceToSchedulingService(row);
}

export async function loadResourcesForWorkspace(
  workspaceId: string,
  resourceIds?: string[],
): Promise<SchedulingResource[]> {
  const prisma = getPrisma();
  const rows = await prisma.voiceStaffMember.findMany({
    where: {
      workspaceId,
      ...(resourceIds?.length ? { id: { in: resourceIds } } : {}),
    },
  });
  return rows.map(staffToResource);
}

export function filterEligibleResources(input: {
  service: SchedulingService;
  resources: SchedulingResource[];
  zone?: string | null;
  urgency?: string | null;
}): SchedulingResource[] {
  let eligible = input.resources;

  if (input.service.eligibleResourceIds.length) {
    const allowed = new Set(input.service.eligibleResourceIds);
    eligible = eligible.filter((r) => allowed.has(r.id));
  }

  if (input.service.requiredSkills.length) {
    const required = new Set(input.service.requiredSkills.map((s) => s.toLowerCase()));
    eligible = eligible.filter((r) =>
      r.skills.some((skill) => required.has(skill.toLowerCase())),
    );
  }

  if (input.zone) {
    const zoneLower = input.zone.toLowerCase();
    eligible = eligible.filter(
      (r) =>
        !r.zones.length ||
        r.zones.some((z) => z.toLowerCase() === zoneLower || z.toLowerCase() === "all"),
    );
  }

  return eligible;
}

export async function resolveServiceAndResources(input: {
  workspaceId: string;
  serviceName: string;
  zone?: string | null;
  urgency?: string | null;
}): Promise<ResourceResolution | null> {
  const service = await loadServiceByName(input.workspaceId, input.serviceName);
  if (!service) return null;

  const allResources = await loadResourcesForWorkspace(
    input.workspaceId,
    service.eligibleResourceIds.length ? service.eligibleResourceIds : undefined,
  );
  const eligibleResources = filterEligibleResources({
    service,
    resources: allResources,
    zone: input.zone,
    urgency: input.urgency,
  });

  return { service, eligibleResources };
}

function slotLabel(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Multi-resource availability — merges staff calendars, hides resource names from caller. */
export async function findMultiResourceAvailability(
  query: AvailabilityQuery,
): Promise<AvailabilityResult> {
  const resolution = await resolveServiceAndResources({
    workspaceId: query.workspaceId,
    serviceName: query.serviceName,
    zone: query.zone,
    urgency: query.urgency,
  });

  if (!resolution) {
    return { slots: [], eligibleResources: [], service: null };
  }

  const { executeAgentTool } = await import("@/lib/voice/agent-tool-gateway/gateway");
  const raw: Record<string, unknown> = {
    serviceName: query.serviceName,
    timezone: query.timezone,
    daysAhead: query.daysAhead ?? 7,
  };
  if (query.preferredStart) raw.from = query.preferredStart;
  if (query.preferredEnd) raw.to = query.preferredEnd;

  const availResult = await executeAgentTool({
    toolType: "calendar_availability",
    context: {
      workspaceId: query.workspaceId,
      agentId: query.agentId,
      callId: undefined,
    },
    raw,
  });

  const rawSlots = Array.isArray(availResult.slots)
    ? (availResult.slots as Array<Record<string, unknown>>)
    : [];

  const eligibleIds = new Set(resolution.eligibleResources.map((r) => r.id));
  const eligibleNames = new Set(resolution.eligibleResources.map((r) => r.name.toLowerCase()));

  const slots: SchedulingSlot[] = [];
  for (const slot of rawSlots) {
    const start = String(slot.startsAt || slot.start_time || slot.start || "");
    if (!start) continue;
    const staffName = String(slot.staffName || slot.resourceName || "");
    const resource = resolution.eligibleResources.find(
      (r) =>
        r.name.toLowerCase() === staffName.toLowerCase() ||
        (!staffName && eligibleIds.size > 0),
    );
    if (staffName && !eligibleNames.has(staffName.toLowerCase()) && resolution.eligibleResources.length > 1) {
      continue;
    }
    const durationMs = resolution.service.durationMinutes * 60_000;
    const end = String(
      slot.endsAt ||
        slot.end_time ||
        new Date(new Date(start).getTime() + durationMs).toISOString(),
    );
    slots.push({
      slotId: `${resource?.id || "default"}:${start}`,
      start,
      end,
      resourceId: resource?.id || resolution.eligibleResources[0]?.id || "default",
      resourceName: resource?.name || staffName || resolution.eligibleResources[0]?.name || "",
      zone: query.zone || null,
      spokenLabel: slotLabel(start, query.timezone),
    });
  }

  // Deduplicate by start time for caller-facing offer (hide technician internals)
  const byStart = new Map<string, SchedulingSlot>();
  for (const slot of slots) {
    if (!byStart.has(slot.start)) byStart.set(slot.start, slot);
  }

  return {
    slots: [...byStart.values()].slice(0, 8),
    eligibleResources: resolution.eligibleResources,
    service: resolution.service,
  };
}

export function schedulingSlotToSlotRef(slot: SchedulingSlot) {
  return {
    slotId: slot.slotId,
    start: slot.start,
    end: slot.end,
    resourceId: slot.resourceId,
    resourceName: slot.resourceName,
    spokenLabel: slot.spokenLabel,
    zone: slot.zone,
  };
}
