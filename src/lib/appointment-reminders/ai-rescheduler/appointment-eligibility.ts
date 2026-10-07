import type { AppointmentMetadata } from "@/lib/appointments/types";
import { evaluateSmsReminderEligibility } from "@/lib/appointment-reminders/sms-eligibility";

export type ArCustomerActionEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Customer C/R/X and AR SMS reschedule apply only to reminder-eligible appointments
 * with an associated contact — not arbitrary imported blocks.
 */
export function evaluateArCustomerActionEligibility(input: {
  appointmentId: string;
  contactId: string | null | undefined;
  status: string;
  metadata: AppointmentMetadata;
  inviteePhone?: string | null;
  contactPhone?: string | null;
}): ArCustomerActionEligibility {
  if (!input.contactId) {
    return { eligible: false, reason: "No customer contact linked to this appointment" };
  }

  const meta = input.metadata;
  if (meta.internalBlock === true || meta.nonCustomerEvent === true) {
    return { eligible: false, reason: "This calendar event is not a customer appointment" };
  }

  const sms = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: input.inviteePhone ?? meta.inviteePhone,
    contactPhone: input.contactPhone,
    appointmentStatus: input.status,
  });
  if (!sms.eligible && sms.blockReason !== "none") {
    return {
      eligible: false,
      reason: sms.detail || "Appointment is not eligible for reminder SMS actions",
    };
  }

  return { eligible: true };
}
