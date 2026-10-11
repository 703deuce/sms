import "server-only";

import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import {
  AR_EXISTING_CUSTOMER_SMS_CONSENT_ATTESTATION_TEXT,
  AR_EXISTING_CUSTOMER_SMS_CONSENT_VERSION,
  getAppointmentRemindersWorkspaceConfig,
} from "@/lib/appointment-reminders/workspace-existing-sms-consent";

export async function recordWorkspaceExistingCustomerSmsConsent(input: {
  workspaceId: string;
  userId: string;
  email?: string | null;
}) {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const current = getAppointmentRemindersWorkspaceConfig(platform);
  const record = {
    attestedAt: new Date().toISOString(),
    attestedByUserId: input.userId,
    attestedByEmail: input.email ?? null,
    version: AR_EXISTING_CUSTOMER_SMS_CONSENT_VERSION,
    attestationText: AR_EXISTING_CUSTOMER_SMS_CONSENT_ATTESTATION_TEXT,
  };
  return saveAppointmentPlatformConfig(input.workspaceId, {
    appointmentReminders: {
      ...current,
      existingCustomerSmsConsent: record,
    },
  });
}
