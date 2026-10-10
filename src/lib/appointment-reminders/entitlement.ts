import "server-only";

import { resolveArWorkspaceCommercial } from "@/lib/appointment-reminders/commercial/ar-workspace-plan";

/**
 * Workspace may use Appointment Reminders when it has an explicit commercial entitlement
 * (free activation, paid Stripe subscription, or explicit TRANSOVO_AR_LEGACY_WORKSPACE_IDS grandfather).
 */
export async function workspaceHasAppointmentReminders(
  workspaceId: string,
  opts?: { isPlatformAdmin?: boolean },
): Promise<boolean> {
  if (opts?.isPlatformAdmin) return true;
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  return commercial.hasProductAccess;
}
