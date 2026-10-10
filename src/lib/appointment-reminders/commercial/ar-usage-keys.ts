import "server-only";

import { resolveArWorkspaceCommercial } from "@/lib/appointment-reminders/commercial/ar-workspace-plan";

export async function getArCommercialUsagePeriodKey(workspaceId: string): Promise<string> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  return commercial.usagePeriod.periodKey;
}
