import type { AppointmentMetadata } from "@/lib/appointments/types";

/** Pure metadata flags when workspace/contact suppression applies (unit-tested). */
export function applyRecipientSuppressionMetadata(
  meta: AppointmentMetadata,
  suppressed: boolean,
): AppointmentMetadata {
  if (!suppressed) return meta;
  return {
    ...meta,
    smsOptOut: true,
    recipientOptedOut: true,
    smsConsent: false,
  };
}
