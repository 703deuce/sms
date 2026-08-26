import "server-only";

import { getPrisma } from "@/lib/db";
import { validateBulkRecipients } from "@/lib/campaigns/enroll-campaign";
import { estimateSmsSegments } from "@/lib/utils";

export type PreSendReview = {
  campaignId: string;
  campaignName: string;
  listIds: string[];
  listNames: string[];
  rawContactCount: number;
  duplicateRemoved: number;
  invalidRemoved: number;
  suppressedRemoved: number;
  finalRecipientCount: number;
  estimatedSegments: number;
  mmsCount: number;
  messagePreview: string;
  phoneNumberId: string | null;
  phoneE164: string | null;
  scheduledAt: string | null;
  a2pUseCase: "MASS_TEXT_MARKETING";
};

export async function buildPreSendReview(
  workspaceId: string,
  campaignId: string,
): Promise<PreSendReview | null> {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) return null;

  const config =
    campaign.configJson && typeof campaign.configJson === "object"
      ? (campaign.configJson as Record<string, unknown>)
      : {};
  const listIds = Array.isArray(config.listIds)
    ? (config.listIds as string[])
    : config.listId
      ? [String(config.listId)]
      : [];

  const listNames: string[] = [];
  const recipients: Array<{ phone?: string; email?: string; contactId?: string; displayName?: string }> =
    [];

  if (listIds.length) {
    const lists = await prisma.contactList.findMany({
      where: { workspaceId, id: { in: listIds } },
      include: {
        members: {
          include: { contact: true },
        },
      },
    });
    for (const list of lists) {
      listNames.push(list.name);
      for (const member of list.members) {
        const c = member.contact;
        if (!c?.phone) continue;
        recipients.push({
          phone: c.phone,
          email: c.email || undefined,
          contactId: c.id,
          displayName: [c.firstName, c.lastName].filter(Boolean).join(" ") || undefined,
        });
      }
    }
  } else {
    const enrolled = await prisma.campaignRecipient.findMany({
      where: { campaignId, workspaceId },
      select: { phone: true, email: true, contactId: true, displayName: true },
    });
    for (const r of enrolled) {
      recipients.push({
        phone: r.phone || undefined,
        email: r.email || undefined,
        contactId: r.contactId || undefined,
        displayName: r.displayName || undefined,
      });
    }
  }

  const rawContactCount = recipients.length;
  const { accepted, rejected } = await validateBulkRecipients(workspaceId, campaignId, recipients);

  const duplicateRemoved = rejected.filter((r) => r.reason === "duplicate_in_batch").length;
  const invalidRemoved = rejected.filter((r) => r.reason === "invalid_phone" || r.reason === "missing_address").length;
  const suppressedRemoved = rejected.filter((r) => r.reason === "suppressed").length;

  const body = campaign.body || "";
  const segmentInfo = estimateSmsSegments(body);
  const isMms = Boolean(config.mediaUrls && Array.isArray(config.mediaUrls) && config.mediaUrls.length);
  const estimatedSegments = isMms
    ? accepted.length
    : accepted.length * Math.max(1, segmentInfo.segments);

  const { resolveMassTextSendingNumber } = await import("@/lib/mass-texting/messaging-registration");
  const sender = await resolveMassTextSendingNumber(workspaceId);

  return {
    campaignId,
    campaignName: campaign.name,
    listIds,
    listNames,
    rawContactCount,
    duplicateRemoved,
    invalidRemoved,
    suppressedRemoved,
    finalRecipientCount: accepted.length,
    estimatedSegments,
    mmsCount: isMms ? accepted.length : 0,
    messagePreview: body.slice(0, 280),
    phoneNumberId: sender?.phoneNumberId ?? null,
    phoneE164: sender?.phoneE164 ?? null,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    a2pUseCase: "MASS_TEXT_MARKETING",
  };
}
