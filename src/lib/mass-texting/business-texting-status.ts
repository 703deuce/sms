import "server-only";

import { assertMassTextMarketingSendAllowed } from "@/lib/mass-texting/a2p-enforcement";
import type { BusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-types";

export type { BusinessTextingCampaignStatus };

/** Authoritative sender gate for Business Texting campaigns (MASS_TEXT_MARKETING use case). */
export async function getBusinessTextingCampaignStatus(
  workspaceId: string,
): Promise<BusinessTextingCampaignStatus> {
  const gate = await assertMassTextMarketingSendAllowed(workspaceId);
  return {
    active: gate.allowed,
    reason: gate.reason,
    phoneE164: gate.phoneE164,
    registrationStatus: gate.registrationStatus,
  };
}
