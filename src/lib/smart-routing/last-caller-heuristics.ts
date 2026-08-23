/** Pure helpers for employee-aware last-caller resolution (safe for tests + client). */

export function isMissedRoutedOutcomeForEmployee(outcome: string | null | undefined): boolean {
  const o = String(outcome || "").toLowerCase();
  if (!o) return true;
  if (o === "connected" || o === "answered" || o === "completed" || o === "transferred") {
    return false;
  }
  return true;
}
