import type { AvailabilitySlot } from "@/lib/appointments/availability-engine-policy";

/** Deterministically hide a percentage of slots (“Make Me Look Busy”). */
export function applyAvailabilityDensityHide(
  slots: AvailabilitySlot[],
  hidePercent?: number,
  seed = "transovo",
): AvailabilitySlot[] {
  const pct = Math.min(90, Math.max(0, hidePercent ?? 0));
  if (!pct || slots.length < 2) return slots;

  const keepRatio = 1 - pct / 100;
  return slots.filter((slot, index) => {
    const hash = simpleHash(`${seed}:${slot.startsAt}:${index}`);
    return hash % 100 < keepRatio * 100;
  });
}

function simpleHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}
