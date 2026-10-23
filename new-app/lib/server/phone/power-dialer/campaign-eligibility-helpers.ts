import { getPrisma } from "@/lib/server/db";
import { parseCampaignAdvanced, type CampaignAdvanced } from "./campaign-advanced";
import { parseExtendedConfig } from "./campaign-extended-config";
import { resolveCampaignRules } from "./campaign-config";
import { evaluateContactEligibility, type EligibilityResult } from "./eligibility";
import { checkWorkspacePhoneFrequency, getWorkspaceDialPolicy } from "./dial-policy";
import { resolveContactDialPhone } from "./phone-resolve";
import { isOnInternalDnc } from "./internal-dnc";
import type { AttemptSummary, PowerDialerCampaignRules } from "./types";
import type { Contact, PowerDialerCampaign } from "@prisma/client";

export type CampaignEligibilityContext = {
  rules: PowerDialerCampaignRules;
  advanced: CampaignAdvanced;
  leadOwnerRouting: "off" | "assigned_only" | "allow_cross_rep";
  dialPolicy: Awaited<ReturnType<typeof getWorkspaceDialPolicy>>;
};

export async function loadCampaignEligibilityContext(
  campaign: PowerDialerCampaign,
): Promise<CampaignEligibilityContext> {
  const rules = resolveCampaignRules(campaign);
  const advanced = parseCampaignAdvanced(campaign.configJson);
  const ext = parseExtendedConfig(campaign.configJson);
  const leadOwnerRouting =
    ext.leadOwnerRouting || advanced.leadOwnerRouting || "off";
  const dialPolicy = await getWorkspaceDialPolicy(campaign.workspaceId);
  return { rules, advanced, leadOwnerRouting, dialPolicy };
}

export async function evaluateListMemberEligibility(input: {
  workspaceId: string;
  campaign: PowerDialerCampaign;
  contact: Contact;
  campaignAttempts: AttemptSummary[];
  sessionAttempts: AttemptSummary[];
  now: Date;
  ctx: CampaignEligibilityContext;
  sessionActive: boolean;
  sessionPaused: boolean;
  hasOpenDispositionBlock?: boolean;
  anyLiveAttemptInSession?: boolean;
  repAuthorized?: boolean;
  sessionRepUserId?: string | null;
  usageBlocked?: boolean;
}): Promise<EligibilityResult> {
  const { e164 } = resolveContactDialPhone(input.contact, input.ctx.rules.phoneFieldPriority);
  const onInternalDnc = e164
    ? await isOnInternalDnc(input.workspaceId, e164)
    : false;
  const freq = e164
    ? await checkWorkspacePhoneFrequency(
        input.workspaceId,
        e164,
        input.now,
        input.ctx.dialPolicy,
      )
    : { ok: true as const };

  return evaluateContactEligibility({
    contact: input.contact,
    rules: input.ctx.rules,
    campaignAttemptsForContact: input.campaignAttempts,
    sessionAttemptsForContact: input.sessionAttempts,
    now: input.now,
    sessionActive: input.sessionActive,
    sessionPaused: input.sessionPaused,
    hasOpenDispositionBlock: input.hasOpenDispositionBlock ?? false,
    anyLiveAttemptInSession: input.anyLiveAttemptInSession ?? false,
    repAuthorized: input.repAuthorized ?? true,
    onInternalDnc,
    usageBlocked: input.usageBlocked ?? false,
    sessionRepUserId: input.sessionRepUserId,
    leadOwnerRouting: input.ctx.leadOwnerRouting,
    advanced: input.ctx.advanced,
    workspaceDialPolicy: input.ctx.dialPolicy,
    workspaceFrequency: freq,
  });
}

/** M25 — due callbacks for rep injected ahead of queue. */
export async function loadDueCallbackContactIds(
  workspaceId: string,
  campaignId: string,
  repUserId: string | null,
  now: Date,
): Promise<string[]> {
  const prisma = getPrisma();
  const rows = await prisma.powerDialerCallback.findMany({
    where: {
      workspaceId,
      campaignId,
      status: "scheduled",
      scheduledAt: { lte: now },
      ...(repUserId
        ? {
            OR: [{ assignedUserId: repUserId }, { assignedUserId: null }],
          }
        : {}),
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
    select: { contactId: true },
  });
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of rows) {
    if (!seen.has(r.contactId)) {
      seen.add(r.contactId);
      ids.push(r.contactId);
    }
  }
  return ids;
}
