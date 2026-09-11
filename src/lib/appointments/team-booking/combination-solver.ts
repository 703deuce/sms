import type { TeamBookingRequirement } from "./types";

export type RequirementSlotCandidates = {
  requirement: TeamBookingRequirement;
  candidates: string[];
};

/**
 * Backtracking search for distinct-staff assignments across requirements.
 * Avoids greedy failures (e.g. Role A: Sarah|James, Role B: Sarah only → James+Sarah).
 */
export function enumerateValidCombinations(
  rows: RequirementSlotCandidates[],
  options?: { fixedStaffByRequirement?: Record<string, string> },
): Array<Record<string, string>> {
  const requiredRows = rows.filter((r) => r.requirement.required || r.requirement.kind !== "optional");
  const optionalRows = rows.filter((r) => !r.requirement.required || r.requirement.kind === "optional");
  const results: Array<Record<string, string>> = [];
  const used = new Set<string>();
  const assignment: Record<string, string> = { ...options?.fixedStaffByRequirement };

  for (const staffId of Object.values(assignment)) {
    used.add(staffId);
  }

  function backtrack(index: number) {
    if (index >= requiredRows.length) {
      results.push({ ...assignment });
      return;
    }
    const row = requiredRows[index];
    const fixed = assignment[row.requirement.id];
    if (fixed !== undefined) {
      if (!row.candidates.includes(fixed)) return;
      backtrack(index + 1);
      return;
    }
    for (const staffId of row.candidates) {
      if (used.has(staffId)) continue;
      assignment[row.requirement.id] = staffId;
      used.add(staffId);
      backtrack(index + 1);
      delete assignment[row.requirement.id];
      used.delete(staffId);
    }
  }

  backtrack(0);

  if (!optionalRows.length) return results;

  const expanded: Array<Record<string, string>> = [];
  for (const base of results) {
    expanded.push(base);
    for (const opt of optionalRows) {
      for (const staffId of opt.candidates) {
        if (Object.values(base).includes(staffId)) continue;
        expanded.push({ ...base, [opt.requirement.id]: staffId });
      }
    }
  }
  return expanded.length ? expanded : results;
}

export function pickPrimaryStaffId(
  requirements: TeamBookingRequirement[],
  assignment: Record<string, string>,
): string {
  const primary = requirements.find((r) => r.kind === "primary");
  if (primary && assignment[primary.id]) return assignment[primary.id];
  const firstRequired = requirements.find((r) => r.required);
  if (firstRequired && assignment[firstRequired.id]) return assignment[firstRequired.id];
  const first = Object.values(assignment)[0];
  return first || "";
}
