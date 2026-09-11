import "server-only";

import { filterStaffAvailableForSlot } from "@/lib/appointments/staff-availability";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import {
  loadSchedulingContext,
  resolveEligibleStaff,
  resolveStaffForBooking,
} from "@/lib/appointments/scheduling-domain";
import { decodeRoutingPolicy, routingMethodLabel } from "@/lib/appointments/routing/routing-model";
import type { BookableStaffMember } from "@/lib/appointments/types";

export type RoutingCandidateRow = {
  staffId: string;
  staffName: string;
  eligible: boolean;
  available: boolean;
  calendarFree: boolean;
  resourceValid: boolean;
  roundRobinCount?: number;
  priorityRank?: number;
  excludedReason?: string;
};

export type RoutingSimulateResult = {
  serviceName: string;
  startsAt: string;
  endsAt: string;
  locationId?: string;
  methodLabel: string;
  customerSelectionLabel: string;
  candidates: RoutingCandidateRow[];
  selectedStaffId: string | null;
  selectedStaffName: string | null;
  reason: string;
  pipeline: string[];
};

async function parseStartsAt(
  workspaceId: string,
  serviceName: string,
  raw: string,
): Promise<{ startsAt: Date; endsAt: Date; durationMinutes: number }> {
  const ctx = await loadSchedulingContext(workspaceId, serviceName);
  const durationMinutes = 30;
  let startsAt: Date;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const { wallTimeInZoneToUtc } = await import("@/lib/voice/calendar/timezone-slots");
    const [datePart, timePart] = raw.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const tz = ctx.svcCfg.timezone || platform.timezone;
    startsAt = wallTimeInZoneToUtc(tz, year, month, day, hour, minute);
  } else {
    startsAt = new Date(raw);
  }
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return { startsAt, endsAt, durationMinutes };
}

export async function simulateRouting(
  workspaceId: string,
  input: {
    serviceName: string;
    startsAt: string;
    locationId?: string;
    preferredStaffId?: string;
  },
): Promise<RoutingSimulateResult> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const scheduling = await loadSchedulingContext(workspaceId, input.serviceName);
  const { startsAt, endsAt, durationMinutes } = await parseStartsAt(
    workspaceId,
    input.serviceName,
    input.startsAt,
  );

  const decoded = decodeRoutingPolicy(scheduling.svcCfg, platform.staffRouting || {});
  const pipeline: string[] = [];
  let eligible = resolveEligibleStaff(scheduling, undefined);
  pipeline.push(`${eligible.length} staff assigned to service`);

  if (input.locationId) {
    eligible = eligible.filter((s) => (s.locationIds || []).includes(input.locationId!));
    pipeline.push(`${eligible.length} valid at selected location`);
  }

  const bufferBeforeMs = (scheduling.svcCfg.bufferBeforeMinutes ?? 0) * 60_000;
  const bufferAfterMs = (scheduling.svcCfg.bufferAfterMinutes ?? 0) * 60_000;
  const slotContext = {
    startsAt,
    endsAt,
    timezone: scheduling.svcCfg.timezone || platform.timezone,
    durationMinutes,
    bufferBeforeMs,
    bufferAfterMs,
    svcCfg: scheduling.svcCfg,
  };

  const rrKey = input.serviceName;
  const rrState = platform.roundRobinState?.[rrKey]?.counts || {};
  const priorityOrder =
    scheduling.svcCfg.staffPriorityOrder?.length
      ? scheduling.svcCfg.staffPriorityOrder
      : platform.staffRouting?.workspaceStaffPriorityOrder || scheduling.svcCfg.staffIds || [];

  const candidates: RoutingCandidateRow[] = [];
  for (const staff of eligible) {
    const availableList = await filterStaffAvailableForSlot(
      workspaceId,
      [staff],
      startsAt,
      endsAt,
      { ...slotContext, platform, mode: "any" },
    );
    const available = availableList.length > 0;
    const rank = priorityOrder.indexOf(staff.id);
    candidates.push({
      staffId: staff.id,
      staffName: staff.name,
      eligible: true,
      available,
      calendarFree: available,
      resourceValid: available,
      roundRobinCount: rrState[staff.id] ?? 0,
      priorityRank: rank >= 0 ? rank + 1 : undefined,
      excludedReason: available ? undefined : "Unavailable for slot",
    });
  }

  const availableCount = candidates.filter((c) => c.available).length;
  pipeline.push(`${availableCount} available at time`);
  pipeline.push(`Routing method: ${routingMethodLabel(decoded.autoMethod)}`);

  const assigned = await resolveStaffForBooking(scheduling, {
    preferredStaffId: input.preferredStaffId,
    startsAt,
    endsAt,
    durationMinutes,
  });

  let reason = "No eligible candidate";
  if (assigned) {
    const row = candidates.find((c) => c.staffId === assigned.id);
    if (decoded.autoMethod === "round_robin" && row) {
      reason = `Lowest routed assignment count among valid candidates (${row.roundRobinCount ?? 0}).`;
    } else if (decoded.autoMethod === "priority") {
      reason = `First eligible staff in priority order (${assigned.name}).`;
    } else if (decoded.autoMethod === "maximize_availability") {
      reason = "Selected staff with greatest open-slot capacity in range.";
    } else if (scheduling.staffAssignment === "customer_chooses" && input.preferredStaffId) {
      reason = "Customer-selected staff preserved after eligibility check.";
    } else {
      reason = "First eligible staff member for this slot.";
    }
  } else if (eligible.length === 0) {
    reason = "No staff assigned to this service.";
  } else if (availableCount === 0) {
    reason = "All assigned staff unavailable for this slot.";
  }

  return {
    serviceName: input.serviceName,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    locationId: input.locationId,
    methodLabel: routingMethodLabel(decoded.autoMethod),
    customerSelectionLabel: decoded.customerSelection,
    candidates,
    selectedStaffId: assigned?.id || null,
    selectedStaffName: assigned?.name || null,
    reason,
    pipeline,
  };
}

/** Dry-run round robin without persisting counter increments (preview only). */
export function previewRoundRobinPick(
  eligible: BookableStaffMember[],
  counts: Record<string, number>,
): BookableStaffMember | null {
  if (!eligible.length) return null;
  let selected = eligible[0];
  let minCount = counts[selected.id] ?? 0;
  for (const staff of eligible) {
    const c = counts[staff.id] ?? 0;
    if (c < minCount) {
      minCount = c;
      selected = staff;
    }
  }
  return selected;
}
