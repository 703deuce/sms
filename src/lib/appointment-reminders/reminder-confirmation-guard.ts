import type { AppointmentMetadata, AppointmentPlatformConfig, ReminderStepConfig } from "@/lib/appointments/types";
import { normalizeAppointmentStatus } from "@/lib/appointments/types";

export function isAppointmentCustomerConfirmed(
  status: string,
  metadata: AppointmentMetadata,
): boolean {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === "confirmed") return true;
  const meta = metadata as { arCustomerConfirmedAt?: string; confirmationSource?: string };
  if (meta.arCustomerConfirmedAt) return true;
  if (meta.confirmationSource === "sms" || meta.confirmationSource === "email" || meta.confirmationSource === "web") {
    return true;
  }
  return false;
}

export function shouldSkipReminderStepForConfirmation(input: {
  stepKey: string;
  step: ReminderStepConfig;
  appointmentStatus: string;
  metadata: AppointmentMetadata;
  platform: Pick<AppointmentPlatformConfig, "reminderPreferences">;
}): boolean {
  const confirmed = isAppointmentCustomerConfirmed(input.appointmentStatus, input.metadata);
  if (!confirmed) return false;

  const workspaceSkip = input.platform.reminderPreferences?.skipConfirmationStepsWhenConfirmed !== false;
  const stepSkip =
    input.step.skipIfAppointmentConfirmed === true ||
    (input.stepKey === "confirmation" && workspaceSkip);

  return stepSkip;
}
