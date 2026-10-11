import type { AppointmentMetadata, AppointmentPlatformConfig } from "@/lib/appointments/types";
import { appointmentMergeVars } from "@/lib/appointments/appointments-service";
import { publicActionUrl, resolveManageLinkFromMetadata } from "@/lib/appointments/settings";

function splitInviteeName(name?: string | null): { firstName: string | null; lastName: string | null } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function reminderAppointmentMergeVars(input: {
  platform: AppointmentPlatformConfig;
  metadata: AppointmentMetadata;
  firstName?: string | null;
  businessName: string;
  service?: string | null;
  staffName?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  timezone: string;
  confirmToken?: string;
  cancelToken?: string;
  rescheduleToken?: string;
}): Record<string, string> {
  const manage = resolveManageLinkFromMetadata(input.metadata, input.rescheduleToken);
  const custom =
    input.platform.reminderPreferences?.customMergeFields &&
    typeof input.metadata === "object"
      ? Object.fromEntries(
          Object.entries(input.platform.reminderPreferences.customMergeFields).map(([k, v]) => {
            const fromMeta = (input.metadata as Record<string, unknown>)[k];
            const fromBooking = (input.metadata as { bookingAnswers?: Record<string, string> })
              .bookingAnswers?.[k];
            return [k, String(fromMeta ?? fromBooking ?? v ?? "")];
          }),
        )
      : {};

  const fromMeta = splitInviteeName(input.metadata.inviteeName as string | undefined);
  const base = appointmentMergeVars({
    firstName: input.firstName || fromMeta.firstName,
    lastName: fromMeta.lastName,
    businessName: input.businessName,
    service: input.service,
    staffName: input.staffName,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
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
  return { ...base, ...custom };
}
