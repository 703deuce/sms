import type { ServicePhaseKind } from "./types";

export type PhaseOccupancyWindow = {
  startsAt: Date;
  endsAt: Date;
  staffRequired: boolean;
  resourceIds: string[];
  phaseKind: ServicePhaseKind;
};

export function buildPhaseOccupancyWindows(
  slotStart: Date,
  phases: Array<{
    phaseKind: ServicePhaseKind;
    durationMinutes: number;
    staffRequired?: boolean;
    resourceIds?: string[];
  }>,
): PhaseOccupancyWindow[] {
  let cursor = slotStart.getTime();
  const windows: PhaseOccupancyWindow[] = [];
  for (const phase of phases) {
    const start = new Date(cursor);
    const end = new Date(cursor + phase.durationMinutes * 60_000);
    windows.push({
      startsAt: start,
      endsAt: end,
      staffRequired: phase.staffRequired ?? phase.phaseKind === "active_staff",
      resourceIds: phase.resourceIds || [],
      phaseKind: phase.phaseKind,
    });
    cursor = end.getTime();
  }
  return windows;
}

/** Staff is busy only during phases where staffRequired is true (processing releases provider). */
export function staffBusyIntervalsFromPhases(
  slotStart: Date,
  phases: Array<{
    phaseKind: ServicePhaseKind;
    durationMinutes: number;
    staffRequired?: boolean;
    resourceIds?: string[];
  }>,
): Array<{ startsAt: Date; endsAt: Date }> {
  return buildPhaseOccupancyWindows(slotStart, phases)
    .filter((w) => w.staffRequired)
    .map((w) => ({ startsAt: w.startsAt, endsAt: w.endsAt }));
}
