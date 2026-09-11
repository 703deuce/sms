import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { loadSchedulingContext } from "@/lib/appointments/scheduling-domain";
import { generateNativeSlots } from "@/lib/appointments/availability-engine";
import { buildRequirementCandidates, resolveTeamAtSlot } from "./team-runtime";
import { requirementsFromService } from "./team-booking-model";

export type TeamAvailabilitySimResult = {
  serviceName: string;
  date: string;
  locationId?: string;
  requirements: Array<{ id: string; label: string; candidates: string[] }>;
  slots: Array<{
    startsAt: string;
    available: boolean;
    reason?: string;
    validTeams?: string[];
    selectedTeam?: string;
    detail?: Awaited<ReturnType<typeof buildRequirementCandidates>>;
  }>;
};

export async function simulateTeamAvailability(
  workspaceId: string,
  input: { serviceName: string; date: string; locationId?: string; preferredLeadStaffId?: string },
): Promise<TeamAvailabilitySimResult> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const scheduling = await loadSchedulingContext(workspaceId, input.serviceName);
  const svcCfg = scheduling.svcCfg;
  const requirements = requirementsFromService(svcCfg, platform);

  const { slots } = await generateNativeSlots(workspaceId, {
    serviceName: input.serviceName,
    daysAhead: 1,
    locationId: input.locationId,
    staffId: input.preferredLeadStaffId,
    maxSlots: 48,
  });

  const dayPrefix = input.date.slice(0, 10);
  const daySlots = slots.filter((s) => s.startsAt.startsWith(dayPrefix) || s.startsAt.includes(dayPrefix));

  const staffName = (id: string) => platform.staff?.find((s) => s.id === id)?.name || id;
  const durationMinutes = 30;
  const bufferBefore = (svcCfg.bufferBeforeMinutes ?? 0) * 60_000;
  const bufferAfter = (svcCfg.bufferAfterMinutes ?? 0) * 60_000;
  const tz = svcCfg.timezone || platform.timezone;

  const slotResults = [];
  for (const slot of daySlots.slice(0, 24)) {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    const detail = await buildRequirementCandidates({
      workspaceId,
      serviceName: input.serviceName,
      startsAt,
      endsAt,
      timezone: tz,
      durationMinutes,
      bufferBeforeMs: bufferBefore,
      bufferAfterMs: bufferAfter,
      svcCfg,
      locationId: input.locationId,
      preferredLeadStaffId: input.preferredLeadStaffId,
    });
    const team = await resolveTeamAtSlot({
      workspaceId,
      serviceName: input.serviceName,
      startsAt,
      endsAt,
      timezone: tz,
      durationMinutes,
      bufferBeforeMs: bufferBefore,
      bufferAfterMs: bufferAfter,
      svcCfg,
      locationId: input.locationId,
      preferredLeadStaffId: input.preferredLeadStaffId,
    });
    const available = Boolean(team);
    slotResults.push({
      startsAt: slot.startsAt,
      available,
      reason: available ? undefined : "No valid team combination",
      validTeams: team ? [team.staffIds.map(staffName).join(" + ")] : [],
      selectedTeam: team ? team.staffIds.map(staffName).join(" + ") : undefined,
      detail,
    });
  }

  return {
    serviceName: input.serviceName,
    date: input.date,
    locationId: input.locationId,
    requirements: requirements.map((r) => ({
      id: r.id,
      label: r.label,
      candidates: [],
    })),
    slots: slotResults,
  };
}
