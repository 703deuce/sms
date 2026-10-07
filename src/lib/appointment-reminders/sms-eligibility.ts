import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  classifyReminderPhone,
  resolveEffectiveReminderPhone,
} from "@/lib/appointment-reminders/effective-phone";

export type SmsReminderBlockReason =
  | "suppressed"
  | "missing_phone"
  | "invalid_phone"
  | "consent_required"
  | "opted_out"
  | "sender_unavailable"
  | "none";

export type SmsReminderEligibility = {
  eligible: boolean;
  blockReason: SmsReminderBlockReason;
  detail: string;
  phone: string | null;
  phoneState: ReturnType<typeof classifyReminderPhone>;
};

function isOptedOut(meta: AppointmentMetadata): boolean {
  if (meta.smsConsent === false) return true;
  if (meta.smsOptOut === true) return true;
  if (meta.recipientOptedOut === true) return true;
  return false;
}

function needsRecipientConsent(meta: AppointmentMetadata): boolean {
  if (meta.emailOnly === true) return true;
  if (meta.smsCapable === false) return true;
  if (meta.smsConsent === true) return false;
  if (meta.existingConsentCertified === true) return false;
  if (meta.existingConsentAttested === true) return false;
  return true;
}

/**
 * Authoritative SMS eligibility for Appointment Reminders (UI + scheduler + delivery).
 */
export function evaluateSmsReminderEligibility(input: {
  metadata: AppointmentMetadata;
  inviteePhone?: string | null;
  contactPhone?: string | null;
  appointmentStatus?: string;
}): SmsReminderEligibility {
  const meta = input.metadata;
  const status = (input.appointmentStatus || "").toLowerCase();

  if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) {
    return {
      eligible: false,
      blockReason: "suppressed",
      detail: "Reminders suppressed for this appointment",
      phone: null,
      phoneState: "missing",
    };
  }

  if (["canceled", "cancelled", "completed", "no_show"].includes(status)) {
    return {
      eligible: false,
      blockReason: "suppressed",
      detail: "Appointment is not active",
      phone: null,
      phoneState: "missing",
    };
  }

  const phone = resolveEffectiveReminderPhone(meta, input.inviteePhone, input.contactPhone);
  const phoneState = classifyReminderPhone(phone);

  if (phoneState === "missing") {
    return {
      eligible: false,
      blockReason: "missing_phone",
      detail: "Phone number required",
      phone,
      phoneState,
    };
  }

  if (phoneState === "invalid") {
    return {
      eligible: false,
      blockReason: "invalid_phone",
      detail: "Invalid phone number",
      phone,
      phoneState,
    };
  }

  if (isOptedOut(meta)) {
    return {
      eligible: false,
      blockReason: "opted_out",
      detail: "Recipient opted out of SMS",
      phone,
      phoneState,
    };
  }

  if (needsRecipientConsent(meta)) {
    return {
      eligible: false,
      blockReason: "consent_required",
      detail: "SMS consent or certified existing permission required",
      phone,
      phoneState,
    };
  }

  return {
    eligible: true,
    blockReason: "none",
    detail: "",
    phone,
    phoneState,
  };
}

export function eligibilityToBlockDetail(eligibility: SmsReminderEligibility): {
  blocked: boolean;
  detail: string;
  hint: string;
} | null {
  if (eligibility.eligible) return null;
  const hints: Record<SmsReminderBlockReason, string> = {
    suppressed: "Open appointment in Appointments",
    missing_phone: "Add phone on Appointments page",
    invalid_phone: "Correct phone on Appointments page",
    consent_required: "Complete consent in Compliance or certify existing permission",
    opted_out: "Recipient opted out — cannot send",
    sender_unavailable: "Fix SMS sender in Business settings",
    none: "",
  };
  return {
    blocked: true,
    detail: eligibility.detail,
    hint: hints[eligibility.blockReason],
  };
}
