import "server-only";

import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import type { AiReschedulerMode } from "@/lib/appointment-reminders/ai-rescheduler/types";
import {
  arPlanDefinition,
  type ArPlanKey,
} from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  arPlanLimitsForWorkspace,
  resolveArWorkspaceCommercial,
} from "@/lib/appointment-reminders/commercial/ar-workspace-plan";

export class ArFeatureGateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function requireArProductAccess(workspaceId: string): Promise<ArPlanKey> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  if (!commercial.hasProductAccess) {
    throw new ArFeatureGateError(
      "ar_no_entitlement",
      "Appointment Reminders is not active on this workspace. Choose a plan to continue.",
    );
  }
  return commercial.planKey;
}

export async function assertAiReschedulerModeAllowed(
  workspaceId: string,
  mode: AiReschedulerMode,
): Promise<void> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanLimitsForWorkspace(commercial);
  if (!plan.aiReschedulerModes.includes(mode)) {
    throw new ArFeatureGateError(
      "ar_plan_ai_mode",
      `Your ${plan.displayName} plan does not include AI rescheduler mode “${mode}”.`,
    );
  }
}

export function countEnabledReminderSteps(config: AppointmentPlatformConfig): number {
  let n = 0;
  if (config.reminders.confirmation.enabled) n += 1;
  if (config.reminders.reminder24h.enabled) n += 1;
  if (config.reminders.reminder2h.enabled) n += 1;
  n += (config.reminders.additionalSteps || []).filter((s) => s.enabled).length;
  return n;
}

export async function validateReminderConfigForPlan(
  workspaceId: string,
  config: AppointmentPlatformConfig,
): Promise<void> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanDefinition(commercial.planKey);
  const steps = countEnabledReminderSteps(config);
  if (steps > plan.reminderStepsMax) {
    throw new ArFeatureGateError(
      "ar_plan_reminder_steps",
      `Your ${plan.displayName} plan allows up to ${plan.reminderStepsMax} reminder step(s). Disable extra steps or upgrade.`,
    );
  }
  if (plan.customReminderTiming === "basic") {
    const hasCustomTiming =
      config.reminders.reminder24h.minutesBefore !== 24 * 60 ||
      config.reminders.reminder2h.minutesBefore !== 2 * 60 ||
      (config.reminders.additionalSteps || []).some((s) => s.enabled);
    if (hasCustomTiming && steps > 1) {
      throw new ArFeatureGateError(
        "ar_plan_timing",
        "Custom reminder timing requires a paid plan.",
      );
    }
  }
}

export async function assertImportCalendarCountAllowed(
  workspaceId: string,
  importCount: number,
): Promise<void> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanLimitsForWorkspace(commercial);
  if (importCount > plan.importedCalendarsMax) {
    throw new ArFeatureGateError(
      "ar_plan_calendars",
      `Your ${plan.displayName} plan allows ${plan.importedCalendarsMax} import calendar(s).`,
    );
  }
}

export async function assertStaffNotifiedFlowsAllowed(workspaceId: string): Promise<void> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanLimitsForWorkspace(commercial);
  if (!plan.staffNotifiedRescheduleCancel) {
    throw new ArFeatureGateError(
      "ar_plan_staff_flows",
      "Staff-notified reschedule and cancel requests require Starter or higher.",
    );
  }
}
