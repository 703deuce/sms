import { getPrisma } from "@/lib/server/db";
import { resolveCampaignRules } from "./campaign-config";
import { evaluateContactEligibility } from "./eligibility";
import type { AttemptSummary, EligibilityBucket } from "./types";

const MAX_ROLLUP_CONTACTS = 5000;

export type EligibilityRollupCounts = Record<EligibilityBucket, number>;

export async function loadCampaignAttemptMap(
  workspaceId: string,
  campaignId: string,
  contactIds: string[],
) {
  const prisma = getPrisma();
  if (!contactIds.length) return new Map<string, AttemptSummary[]>();
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      contactId: { in: contactIds },
      session: { campaignId },
    },
    select: {
      contactId: true,
      status: true,
      disposition: true,
      attemptNumber: true,
      createdAt: true,
      endedAt: true,
      callbackAt: true,
    },
  });
  const map = new Map<string, AttemptSummary[]>();
  for (const a of attempts) {
    const list = map.get(a.contactId) || [];
    list.push(a);
    map.set(a.contactId, list);
  }
  return map;
}

export async function computeCampaignEligibilityRollups(
  workspaceId: string,
  campaignId: string,
): Promise<{ counts: EligibilityRollupCounts; truncated: boolean }> {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: { list: { include: { members: { include: { contact: true }, take: MAX_ROLLUP_CONTACTS } } } },
  });
  if (!campaign) throw new Error("Campaign not found");

  const rules = resolveCampaignRules(campaign);
  const members = campaign.list.members;
  const truncated = members.length >= MAX_ROLLUP_CONTACTS;
  const contactIds = members.map((m) => m.contactId);
  const attemptMap = await loadCampaignAttemptMap(workspaceId, campaignId, contactIds);

  const counts: EligibilityRollupCounts = {
    eligible: 0,
    deferred: 0,
    completed: 0,
    suppressed: 0,
    failed: 0,
  };

  const now = new Date();
  for (const m of members) {
    const eligibility = evaluateContactEligibility({
      contact: m.contact,
      rules,
      campaignAttemptsForContact: attemptMap.get(m.contact.id) || [],
      sessionAttemptsForContact: [],
      now,
      sessionActive: campaign.status === "active",
      sessionPaused: campaign.status === "paused",
      hasOpenDispositionBlock: false,
      anyLiveAttemptInSession: false,
      repAuthorized: true,
    });
    counts[eligibility.bucket] += 1;
  }

  return { counts, truncated };
}
