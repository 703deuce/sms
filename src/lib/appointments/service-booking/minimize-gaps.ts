import "server-only";

export type RankableSlot = { startsAt: string; endsAt: string };

/**
 * Deterministic slot ranking — prefers slots adjacent to existing bookings when mode is prefer_compact.
 * Never marks unavailable slots as available; only reorders a provided feasible set.
 */
export function rankSlotsByScheduleDensity(
  slots: RankableSlot[],
  existingStarts: Date[],
  mode: "off" | "prefer_compact" = "off",
): RankableSlot[] {
  if (mode !== "prefer_compact" || slots.length <= 1) {
    return [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  const existing = existingStarts.map((d) => d.getTime()).sort((a, b) => a - b);
  return [...slots].sort((a, b) => {
    const aScore = adjacencyScore(new Date(a.startsAt).getTime(), existing);
    const bScore = adjacencyScore(new Date(b.startsAt).getTime(), existing);
    if (aScore !== bScore) return aScore - bScore;
    return a.startsAt.localeCompare(b.startsAt);
  });
}

function adjacencyScore(startMs: number, existing: number[]): number {
  if (existing.length === 0) return 1_000_000;
  let best = Number.POSITIVE_INFINITY;
  for (const e of existing) {
    best = Math.min(best, Math.abs(startMs - e));
  }
  return best;
}
