import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import {
  resolveAiReschedulerConfig,
  type AiReschedulerConfig,
  type AiReschedulerMode,
} from "@/lib/appointment-reminders/ai-rescheduler/types";
import { resolveArPlanCapabilities } from "@/lib/appointment-reminders/commercial/ar-plan-capabilities";

function capMode(
  requested: AiReschedulerMode,
  allowed: AiReschedulerMode[],
): AiReschedulerMode {
  if (allowed.includes(requested)) return requested;
  if (allowed.includes("notify")) return "notify";
  return "reminders_only";
}

/** Runtime AI rescheduler config capped by commercial plan (authoritative for inbound/send). */
export async function resolveArAiReschedulerConfigForWorkspace(
  workspaceId: string,
): Promise<AiReschedulerConfig> {
  const [platform, caps] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    resolveArPlanCapabilities(workspaceId),
  ]);
  const ar = resolveAiReschedulerConfig(platform);
  const mode = capMode(ar.mode, caps.aiReschedulerModes);
  if (mode === ar.mode) return ar;
  return { ...ar, mode };
}
