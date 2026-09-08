import type { ClassCapacityDisplayMode } from "./types";

export function formatPublicCapacityLabel(
  remaining: number,
  capacity: number,
  mode: ClassCapacityDisplayMode = "limited",
): string | null {
  if (mode === "hidden") return null;
  if (remaining <= 0) return "Full";
  if (mode === "exact") {
    return remaining === 1 ? "1 spot left" : `${remaining} spots left`;
  }
  const ratio = remaining / Math.max(1, capacity);
  if (ratio <= 0.25) return "Limited availability";
  return "Available";
}
