import { getPrisma } from "@/lib/server/db";
import { resolveCampaignRules } from "./campaign-config";
import { evaluateContactEligibility, reasonToUserMessage } from "./eligibility";
import { loadCampaignAttemptMap } from "./campaign-rollups";
import type { EligibilityBucket } from "./types";

const MAX_BUCKET_SCAN = 5000;

function buildMemberWhere(listId: string, search?: string) {
  const searchTrim = search?.trim().toLowerCase();
  return {
    listId,
    ...(searchTrim
      ? {
          contact: {
            OR: [
              { firstName: { contains: searchTrim, mode: "insensitive" as const } },
              { lastName: { contains: searchTrim, mode: "insensitive" as const } },
              { company: { contains: searchTrim, mode: "insensitive" as const } },
              { phone: { contains: searchTrim.replace(/\D/g, "") } },
            ],
          },
        }
      : {}),
  };
}

type ContactRow = {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  company: string | null;
  timezone: string | null;
  assignedUser: string | null;
  customFields: unknown;
  bucket: string;
  reason: string;
  reasonLabel: string;
  retryEligibleAt: string | null;
  attemptCount: number;
  latestDisposition: string | null;
  latestStatus: string | null;
  nextCallbackAt: string | null;
};

async function mapMembersToRows(
  workspaceId: string,
  campaignId: string,
  campaign: { status: string; listId: string },
  members: { contact: import("@prisma/client").Contact }[],
  rules: ReturnType<typeof resolveCampaignRules>,
  bucketFilter?: EligibilityBucket | "all",
): Promise<ContactRow[]> {
  const contactIds = members.map((m) => m.contact.id);
  const attemptMap = await loadCampaignAttemptMap(workspaceId, campaignId, contactIds);
  const now = new Date();
  const rows: ContactRow[] = [];

  for (const m of members) {
    const attempts = attemptMap.get(m.contact.id) || [];
    const eligibility = evaluateContactEligibility({
      contact: m.contact,
      rules,
      campaignAttemptsForContact: attempts,
      sessionAttemptsForContact: [],
      now,
      sessionActive: campaign.status === "active",
      sessionPaused: campaign.status === "paused",
      hasOpenDispositionBlock: false,
      anyLiveAttemptInSession: false,
      repAuthorized: true,
    });
    if (bucketFilter && bucketFilter !== "all" && eligibility.bucket !== bucketFilter) {
      continue;
    }

    const sorted = [...attempts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = sorted[0];
    const openCallback = sorted.find((a) => a.disposition?.toLowerCase() === "callback" && a.callbackAt);

    rows.push({
      contactId: m.contact.id,
      firstName: m.contact.firstName,
      lastName: m.contact.lastName,
      phone: m.contact.phone,
      company: m.contact.company,
      timezone: m.contact.timezone,
      assignedUser: m.contact.assignedUser,
      customFields: m.contact.customFields,
      bucket: eligibility.bucket,
      reason: eligibility.reason,
      reasonLabel: reasonToUserMessage(eligibility.reason),
      retryEligibleAt: eligibility.retryEligibleAt?.toISOString() ?? null,
      attemptCount: attempts.filter((a) => a.endedAt || a.disposition).length,
      latestDisposition: latest?.disposition ?? null,
      latestStatus: latest?.status ?? null,
      nextCallbackAt: openCallback?.callbackAt?.toISOString() ?? null,
    });
  }
  return rows;
}

export async function listCampaignContacts(
  workspaceId: string,
  campaignId: string,
  input: {
    page: number;
    pageSize: number;
    bucket?: EligibilityBucket | "all";
    search?: string;
  },
) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: { list: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const rules = resolveCampaignRules(campaign);
  const memberWhere = buildMemberWhere(campaign.listId, input.search);
  const totalMembers = await prisma.contactListMember.count({ where: memberWhere });
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const bucket = input.bucket ?? "all";

  if (bucket === "all") {
    const members = await prisma.contactListMember.findMany({
      where: memberWhere,
      include: { contact: true },
      orderBy: { contact: { lastName: "asc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const rows = await mapMembersToRows(workspaceId, campaignId, campaign, members, rules, "all");
    return {
      rows,
      page,
      pageSize,
      totalMembers,
      filteredCount: totalMembers,
    };
  }

  const scanCap = Math.min(totalMembers, MAX_BUCKET_SCAN);
  const allMembers = await prisma.contactListMember.findMany({
    where: memberWhere,
    include: { contact: true },
    orderBy: { contact: { lastName: "asc" } },
    take: scanCap,
  });
  const filtered = await mapMembersToRows(workspaceId, campaignId, campaign, allMembers, rules, bucket);
  const filteredCount = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  return {
    rows,
    page,
    pageSize,
    totalMembers,
    filteredCount,
    bucketScanTruncated: totalMembers > scanCap,
  };
}
