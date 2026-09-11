import "server-only";

import { filterStaffAvailableForSlot } from "@/lib/appointments/staff-availability";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { loadSchedulingContext, resolveEligibleStaff } from "@/lib/appointments/scheduling-domain";
import type { AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";
import {
  enumerateValidCombinations,
  pickPrimaryStaffId,
  type RequirementSlotCandidates,
} from "./combination-solver";
import { requirementsFromService, resolveTeamServiceConfig } from "./team-booking-model";
import type { ResolvedTeamAssignment, TeamBookingRequirement } from "./types";

export type TeamSlotContext = {
  workspaceId: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  durationMinutes: number;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  svcCfg: AppointmentTypeConfig;
  locationId?: string;
  preferredLeadStaffId?: string;
  busyIndex?: import("@/lib/appointments/staff-availability").AppointmentBusyIndex;
  externalBusyByStaff?: Map<string, Array<{ start: Date; end: Date }>>;
};

function candidateIdsForRequirement(
  req: TeamBookingRequirement,
  eligible: BookableStaffMember[],
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
): string[] {
  if (req.assignment.mode === "specific_staff") {
    return eligible.some((s) => s.id === req.assignment.staffId) ? [req.assignment.staffId] : [];
  }
  if (req.assignment.mode === "staff_pool") {
    const pool = platform.schedulingGroups?.find((g) => g.id === req.assignment.poolId);
    const poolIds = pool?.memberStaffIds || [];
    return eligible.filter((s) => poolIds.includes(s.id)).map((s) => s.id);
  }
  const subset = req.assignment.staffIds?.length
    ? eligible.filter((s) => req.assignment.staffIds!.includes(s.id))
    : eligible;
  return subset.map((s) => s.id);
}

export async function buildRequirementCandidates(
  ctx: TeamSlotContext,
): Promise<RequirementSlotCandidates[]> {
  const platform = await loadAppointmentPlatformConfig(ctx.workspaceId);
  const scheduling = await loadSchedulingContext(ctx.workspaceId, ctx.serviceName);
  let eligible = resolveEligibleStaff(scheduling);
  if (ctx.locationId) {
    const { filterStaffIdsForLocation } = await import(
      "@/lib/appointments/service-booking/location-scheduling"
    );
    const ids = filterStaffIdsForLocation(platform, ctx.locationId, eligible.map((s) => s.id));
    eligible = eligible.filter((s) => ids.includes(s.id));
  }

  const requirements = requirementsFromService(ctx.svcCfg, platform);
  const slotOpts = {
    timezone: ctx.timezone,
    durationMinutes: ctx.durationMinutes,
    bufferBeforeMs: ctx.bufferBeforeMs,
    bufferAfterMs: ctx.bufferAfterMs,
    platform,
    svcCfg: ctx.svcCfg,
    mode: "any" as const,
    busyIndex: ctx.busyIndex,
    externalBusyByStaff: ctx.externalBusyByStaff,
  };

  const rows: RequirementSlotCandidates[] = [];
  for (const req of requirements) {
    if (!req.required && req.kind === "optional") {
      rows.push({ requirement: req, candidates: [] });
      continue;
    }
    const poolIds = candidateIdsForRequirement(req, eligible, platform);
    const members = eligible.filter((s) => poolIds.includes(s.id));
    const available = await filterStaffAvailableForSlot(
      ctx.workspaceId,
      members,
      ctx.startsAt,
      ctx.endsAt,
      slotOpts,
    );
    rows.push({ requirement: req, candidates: available.map((s) => s.id) });
  }
  return rows;
}

function scoreCombination(
  assignment: Record<string, string>,
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  serviceName: string,
): number {
  const counts = platform.roundRobinState?.[serviceName]?.counts || {};
  let score = 0;
  for (const staffId of Object.values(assignment)) {
    score += counts[staffId] ?? 0;
  }
  return score;
}

export async function resolveTeamAtSlot(ctx: TeamSlotContext): Promise<ResolvedTeamAssignment | null> {
  const platform = await loadAppointmentPlatformConfig(ctx.workspaceId);
  const teamCfg = resolveTeamServiceConfig(ctx.svcCfg, platform);
  if (!teamCfg.enabled || !teamCfg.requirements?.length) return null;

  const rows = await buildRequirementCandidates(ctx);
  const fixed: Record<string, string> = {};
  if (ctx.preferredLeadStaffId) {
    const primaryReq = teamCfg.requirements.find((r) => r.kind === "primary") || teamCfg.requirements[0];
    if (primaryReq) fixed[primaryReq.id] = ctx.preferredLeadStaffId;
  }

  const combinations = enumerateValidCombinations(rows, { fixedStaffByRequirement: fixed });
  if (!combinations.length) return null;

  const sorted = [...combinations].sort(
    (a, b) => scoreCombination(a, platform, ctx.serviceName) - scoreCombination(b, platform, ctx.serviceName),
  );
  const chosen = sorted[0];
  const primaryStaffId = pickPrimaryStaffId(teamCfg.requirements, chosen);
  const staffIds = [...new Set(Object.values(chosen))];
  const assignments = teamCfg.requirements
    .filter((r) => chosen[r.id])
    .map((r) => ({
      requirementId: r.id,
      staffId: chosen[r.id],
      label: r.label,
    }));

  return { primaryStaffId, staffIds, assignments };
}

export async function slotHasValidTeam(ctx: TeamSlotContext): Promise<boolean> {
  const team = await resolveTeamAtSlot(ctx);
  return Boolean(team?.staffIds.length);
}
