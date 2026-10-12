import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resolveEffectiveReminderPhone } from "@/lib/appointment-reminders/effective-phone";
import { isValidReminderPhone } from "@/lib/appointment-reminders/aggregate-reminder-status";

/** All normalized SMS recipient numbers for an appointment (deduped). */
export function resolveReminderRecipientPhones(
  meta: AppointmentMetadata,
  contactPhone?: string | null,
): string[] {
  const fromList = (meta.reminderRecipientPhones || [])
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && isValidReminderPhone(p)));
  const primary = resolveEffectiveReminderPhone(meta, meta.inviteePhone, contactPhone);
  const deduped = [...new Set(fromList)];
  if (primary && isValidReminderPhone(primary)) {
    const rest = deduped.filter((p) => p !== primary);
    if (rest.length || deduped.length) {
      return [primary, ...rest];
    }
    return [primary];
  }
  if (!deduped.length && primary && isValidReminderPhone(primary)) {
    return [primary];
  }
  return deduped;
}
