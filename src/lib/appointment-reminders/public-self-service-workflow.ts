import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import {
  isArRemindersOnlyMode,
  isSelfServiceLinkMode,
  resolveAiReschedulerConfig,
} from "@/lib/appointment-reminders/ai-rescheduler/types";
import { resolveArPlanCapabilities } from "@/lib/appointment-reminders/commercial/ar-plan-capabilities";

export type PublicAppointmentChangeWorkflow = "instant" | "request_only";

export async function resolvePublicAppointmentChangeWorkflow(
  workspaceId: string,
): Promise<PublicAppointmentChangeWorkflow> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (isSelfServiceLinkMode(ar)) {
    return ar.approval === "business" ? "request_only" : "instant";
  }
  const caps = await resolveArPlanCapabilities(workspaceId);
  if (!caps.staffNotifiedRescheduleCancel) return "instant";
  if (isArRemindersOnlyMode(ar)) return "instant";
  return "request_only";
}
