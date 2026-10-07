import type { AppointmentMetadata } from "@/lib/appointments/types";
import { isValidReminderPhone } from "@/lib/appointment-reminders/aggregate-reminder-status";

/** Single policy for UI, scheduling, and SMS delivery. */
export function resolveEffectiveReminderPhone(
  meta: AppointmentMetadata,
  inviteePhone?: string | null,
  contactPhone?: string | null,
): string | null {
  const override = meta.reminderOverride?.phone?.trim();
  if (override) return override;
  const fromMeta = meta.inviteePhone?.trim() || inviteePhone?.trim() || contactPhone?.trim() || null;
  if (!fromMeta) return null;
  if (fromMeta.startsWith("email:")) return null;
  if (fromMeta.includes("@") && !fromMeta.startsWith("+")) return null;
  return fromMeta;
}

export type ReminderPhoneState = "ok" | "missing" | "invalid";

export function classifyReminderPhone(phone: string | null): ReminderPhoneState {
  if (!phone?.trim()) return "missing";
  if (!isValidReminderPhone(phone)) return "invalid";
  return "ok";
}
