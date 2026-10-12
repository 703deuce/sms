import type { AppointmentPlatformConfig } from "@/lib/appointments/types";

/** Attestation copy version — bump when legal text changes (re-attest required). */
export const AR_EXISTING_CUSTOMER_SMS_CONSENT_VERSION = "ar_existing_sms_v1";

export const AR_EXISTING_CUSTOMER_SMS_CONSENT_ATTESTATION_TEXT =
  "I confirm that my business already has permission to send appointment-related SMS messages to customers whose appointments appear on the calendars I connect to Transovo. This includes customers I schedule in Outlook or Google Calendar. I will honor opt-outs and STOP requests. This does not override recipient opt-out or carrier compliance rules.";

export type ArExistingCustomerSmsConsentRecord = {
  attestedAt: string;
  attestedByUserId: string;
  attestedByEmail?: string | null;
  version: string;
  attestationText: string;
};

export type AppointmentRemindersWorkspaceConfig = {
  existingCustomerSmsConsent?: ArExistingCustomerSmsConsentRecord | null;
  operationalPause?: import("@/lib/appointment-reminders/ar-operational-pause").ArOperationalPauseState | null;
  /** Set when setup configure step is saved (wizard step 2). */
  setupConfigureCompletedAt?: string | null;
  /** Reflect customer confirmations / cancellations / reschedules on connected calendars. */
  calendarWriteBack?: {
    enabled?: boolean;
    colorCodingEnabled?: boolean;
  } | null;
};

export function getAppointmentRemindersWorkspaceConfig(
  platform: AppointmentPlatformConfig,
): AppointmentRemindersWorkspaceConfig {
  return (platform.appointmentReminders || {}) as AppointmentRemindersWorkspaceConfig;
}

export const AR_EXISTING_CUSTOMER_SMS_CONSENT_BLOCKER =
  "Certify that you already have permission to text customers on the calendars I connect to Transovo";

export function isArExistingCustomerSmsConsentBlocker(message: string): boolean {
  return message.includes("Certify that you already have permission");
}

export function hasWorkspaceExistingCustomerSmsConsent(
  platform: AppointmentPlatformConfig | null | undefined,
  opts?: { grandfatherActivatedAt?: string | null },
): boolean {
  const record = getAppointmentRemindersWorkspaceConfig(platform || ({} as AppointmentPlatformConfig))
    .existingCustomerSmsConsent;
  if (record?.attestedAt && record.version === AR_EXISTING_CUSTOMER_SMS_CONSENT_VERSION) {
    return true;
  }
  if (opts?.grandfatherActivatedAt) return true;
  return false;
}
