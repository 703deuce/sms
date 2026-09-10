import "server-only";

import { getBusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-status";
import type { BusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-types";

export async function loadAppointmentsCampaignsSenderStatus(
  workspaceId: string | null,
): Promise<BusinessTextingCampaignStatus | null> {
  if (!workspaceId) return null;
  return getBusinessTextingCampaignStatus(workspaceId);
}
