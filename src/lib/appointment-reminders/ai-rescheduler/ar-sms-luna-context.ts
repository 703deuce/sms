import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveAiReschedulerConfig } from "./types";
import {
  evaluateArSmsActionPolicy,
  resolveArCancelSmsPolicy,
  resolveArRescheduleSmsPolicy,
} from "./ar-sms-action-policy";
import { resolveArAppointmentDisplayTimezone } from "./display-time";

export async function buildArLunaVerifiedContextBlock(input: {
  workspaceId: string;
  appointmentId: string;
  sessionLifecycleState: string;
}): Promise<string> {
  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);

  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: {
      serviceName: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      status: true,
      metadata: true,
    },
  });
  if (!row) return "appointment=unknown";

  const workspace = await prisma.workspace.findFirst({
    where: { id: input.workspaceId },
    select: { name: true, displayName: true },
  });

  const meta = (row.metadata || {}) as {
    timezone?: string;
    meetingUrl?: string;
    joinUrl?: string;
    locationName?: string;
  };

  const displayTz = resolveArAppointmentDisplayTimezone({
    appointmentTimezone: row.timezone,
    metadataTimezone: meta.timezone,
    platformTimezone: platform.timezone,
  });

  const whenLocal = row.startsAt.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: displayTz,
  });

  const reschedulePolicy = evaluateArSmsActionPolicy({
    action: "reschedule",
    startsAt: row.startsAt,
    policy: resolveArRescheduleSmsPolicy(ar),
  });
  const cancelPolicy = evaluateArSmsActionPolicy({
    action: "cancel",
    startsAt: row.startsAt,
    policy: resolveArCancelSmsPolicy(ar),
  });

  const lines = [
    `business_name=${workspace?.displayName || workspace?.name || "Business"}`,
    `appointment_id=${input.appointmentId}`,
    `appointment_title=${row.serviceName || "Appointment"}`,
    `appointment_status=${row.status}`,
    `appointment_starts_at_local=${whenLocal}`,
    `display_timezone=${displayTz}`,
    meta.locationName ? `location=${meta.locationName}` : null,
    meta.meetingUrl || meta.joinUrl ? `meeting_link=${meta.meetingUrl || meta.joinUrl}` : null,
    `reply_session_lifecycle=${input.sessionLifecycleState}`,
    `sms_reschedule_policy_inside_cutoff=${reschedulePolicy.insideCutoff}`,
    `sms_reschedule_automated_allowed=${reschedulePolicy.allowsAutomatedAction}`,
    reschedulePolicy.penaltySummary
      ? `sms_reschedule_late_penalty=${reschedulePolicy.penaltySummary}`
      : null,
    `sms_cancel_policy_inside_cutoff=${cancelPolicy.insideCutoff}`,
    `sms_cancel_automated_allowed=${cancelPolicy.allowsAutomatedAction}`,
    cancelPolicy.penaltySummary ? `sms_cancel_late_penalty=${cancelPolicy.penaltySummary}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}
