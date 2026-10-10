import type { AppointmentMetadata } from "@/lib/appointments/types";

export type EmailReminderBlockReason =
  | "suppressed"
  | "missing_email"
  | "invalid_email"
  | "recipient_sms_only"
  | "none";

export type EmailReminderEligibility = {
  eligible: boolean;
  blockReason: EmailReminderBlockReason;
  detail: string;
  email: string | null;
};

function basicEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function evaluateEmailReminderEligibility(input: {
  metadata: AppointmentMetadata;
  inviteeEmail?: string | null;
  contactEmail?: string | null;
  appointmentStatus?: string;
}): EmailReminderEligibility {
  const meta = input.metadata;
  const status = (input.appointmentStatus || "").toLowerCase();

  if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) {
    return {
      eligible: false,
      blockReason: "suppressed",
      detail: "Reminders suppressed for this appointment",
      email: null,
    };
  }

  if (["canceled", "cancelled", "completed", "no_show"].includes(status)) {
    return {
      eligible: false,
      blockReason: "suppressed",
      detail: "Appointment is not active",
      email: null,
    };
  }

  if (meta.recipientNotificationChannel === "sms") {
    return {
      eligible: false,
      blockReason: "recipient_sms_only",
      detail: "Recipient prefers SMS only",
      email: null,
    };
  }

  const email = (input.inviteeEmail || meta.inviteeEmail || input.contactEmail || "").trim();
  if (!email) {
    return {
      eligible: false,
      blockReason: "missing_email",
      detail: "Email address required for email reminders",
      email: null,
    };
  }

  if (!basicEmailValid(email)) {
    return {
      eligible: false,
      blockReason: "invalid_email",
      detail: "Invalid email address",
      email,
    };
  }

  return { eligible: true, blockReason: "none", detail: "OK", email };
}
