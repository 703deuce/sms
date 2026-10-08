import {
  USAGE_PERIOD_KEY,
  USAGE_USED,
} from "@/lib/appointment-reminders/ar-sms-usage-constants";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readArSmsUsedFromLimits(
  limitsInput: unknown,
  periodKey: string,
): number {
  const limits = asRecord(limitsInput);
  const storedPeriod = String(limits[USAGE_PERIOD_KEY] || "");
  let used = Number(limits[USAGE_USED] || 0);
  if (storedPeriod !== periodKey) used = 0;
  return used;
}
