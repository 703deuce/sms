/**
 * @deprecated Metering uses in-process lock + workspaceLimits upsert in ar-sms-usage.ts.
 * Kept for import stability; math helpers live in ar-sms-usage-limit-math.ts.
 */
export { readArSmsUsedFromLimits } from "@/lib/appointment-reminders/ar-sms-usage-limit-math";
