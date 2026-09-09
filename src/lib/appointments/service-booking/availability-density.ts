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
  const targetKeep = Math.max(1, Math.floor(slots.length * keepRatio));
  if (targetKeep >= slots.length) {
    return slots.slice(0, Math.max(1, slots.length - 1));
  }
  const filtered = slots.filter((slot, index) => {
    const hash = simpleHash(`${seed}:${slot.startsAt}:${index}`);
    return hash % 100 < keepRatio * 100;
  });
  if (filtered.length > targetKeep) {
    return filtered.slice(0, targetKeep);
  }
  if (filtered.length < targetKeep) {
    return slots.slice(0, targetKeep);
  }
  return filtered.length < slots.length ? filtered : slots.slice(0, targetKeep);
}

function simpleHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}
