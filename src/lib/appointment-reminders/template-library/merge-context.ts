import type { AppointmentMetadata, AppointmentPlatformConfig } from "@/lib/appointments/types";
import { appointmentMergeVars, resolveManageLinkFromMetadata } from "@/lib/appointments/appointments-service";
import { publicActionUrl } from "@/lib/appointments/settings";

export function reminderAppointmentMergeVars(input: {
  platform: AppointmentPlatformConfig;
  metadata: AppointmentMetadata;
  firstName?: string | null;
  businessName: string;
  service?: string | null;
  startsAt: Date;
  timezone: string;
  confirmToken?: string;
  cancelToken?: string;
  rescheduleToken?: string;
}): Record<string, string> {
  const manage = resolveManageLinkFromMetadata(input.metadata, input.rescheduleToken);
  return appointmentMergeVars({
    firstName: input.firstName,
    businessName: input.businessName,
    service: input.service,
    startsAt: input.startsAt,
    timezone: input.timezone,
    location:
      (typeof input.metadata.location === "string" ? input.metadata.location : undefined) ||
      input.platform.businessAddress ||
      "",
    confirmLink: input.confirmToken ? publicActionUrl("confirm", input.confirmToken) : "",
    cancelLink: input.cancelToken ? publicActionUrl("cancel", input.cancelToken) : "",
    rescheduleLink: input.rescheduleToken
      ? publicActionUrl("reschedule", input.rescheduleToken)
      : "",
    manageLink: manage,
    appointmentLink: manage,
    meetingLink: input.metadata.meetingUrl || input.metadata.joinUrl || "",
    businessPhone:
      input.platform.businessPhone ||
      input.platform.reminderEmailBranding?.contactPhone ||
      "",
    directionsLink: input.platform.reminderEmailBranding?.directionsUrl || "",
  });
}
