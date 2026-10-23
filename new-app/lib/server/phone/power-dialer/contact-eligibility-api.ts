import { getPrisma } from "@/lib/server/db";
import { resolveCampaignRules } from "./campaign-config";
import { evaluateContactEligibility, reasonToUserMessage } from "./eligibility";
import { loadCampaignAttemptMap } from "./campaign-rollups";

export async function evaluatePowerDialerContactEligibility(
  workspaceId: string,
  campaignId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: { list: { include: { members: { where: { contactId }, include: { contact: true } } } } },
  });
  if (!campaign) throw new Error("Campaign not found");
  const member = campaign.list.members[0];
  if (!member) throw new Error("Contact is not on this campaign list");
  const rules = resolveCampaignRules(campaign);
  const attemptMap = await loadCampaignAttemptMap(workspaceId, campaignId, [contactId]);
  const attempts = attemptMap.get(contactId) || [];
  const eligibility = evaluateContactEligibility({
    contact: member.contact,
    rules,
    campaignAttemptsForContact: attempts,
    sessionAttemptsForContact: [],
    now: new Date(),
    sessionActive: campaign.status === "active",
    sessionPaused: campaign.status === "paused",
    hasOpenDispositionBlock: false,
    anyLiveAttemptInSession: false,
    repAuthorized: true,
  });
  return {
    eligible: eligibility.eligible,
    bucket: eligibility.bucket,
    reason: eligibility.reason,
    message: reasonToUserMessage(eligibility.reason),
    retryEligibleAt: eligibility.retryEligibleAt ?? null,
  };
}
