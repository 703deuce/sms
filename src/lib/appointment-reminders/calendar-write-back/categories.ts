import type { ArCalendarWriteBackKind } from "./types";

/** Outlook category display names (color follows the user's category master list). */
export const TRANSOVO_CATEGORY_PREFIX = "Transovo: ";

export function transovoCategoryForWriteBackKind(
  kind: ArCalendarWriteBackKind | "pending",
): string {
  switch (kind) {
    case "confirmed":
      return `${TRANSOVO_CATEGORY_PREFIX}Confirmed`;
    case "pending":
      return `${TRANSOVO_CATEGORY_PREFIX}Pending`;
    case "cancellation_requested":
      return `${TRANSOVO_CATEGORY_PREFIX}Cancellation requested`;
    case "canceled":
      return `${TRANSOVO_CATEGORY_PREFIX}Canceled`;
    case "reschedule_requested":
      return `${TRANSOVO_CATEGORY_PREFIX}Reschedule requested`;
    case "rescheduled":
      return `${TRANSOVO_CATEGORY_PREFIX}Rescheduled`;
    default:
      return `${TRANSOVO_CATEGORY_PREFIX}Updated`;
  }
}

export function mergeTransovoOutlookCategories(
  existing: string[] | undefined,
  kind: ArCalendarWriteBackKind | "pending",
  colorCodingEnabled: boolean,
): string[] {
  const base = (existing || []).filter((c) => !c.startsWith(TRANSOVO_CATEGORY_PREFIX));
  if (!colorCodingEnabled) return base;
  return [...base, transovoCategoryForWriteBackKind(kind)];
}
