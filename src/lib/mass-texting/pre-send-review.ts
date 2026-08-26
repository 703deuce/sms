import "server-only";

import { getPrisma } from "@/lib/db";
import { validateBulkRecipients } from "@/lib/campaigns/enroll-campaign";
import { parseSequence } from "@/lib/campaigns/sequence-engine";
import { MASS_TEXT_MMS_PRODUCTION_ENABLED } from "@/lib/mass-texting/pricing";
import { creditsForRecipientBody, massTextMergeVarsFromContact } from "@/lib/mass-texting/personalization";
import { getSegmentAvailability } from "@/lib/mass-texting/credit-accounting";
import { mediaUrlsForSequenceStep } from "@/lib/mass-texting/mms";

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
  availableSegments: number;
  requiredSegments: number;
  shortage: number;
  canSend: boolean;
  blockReason: string | null;
  mmsBlocked: boolean;
  acceptedPhones: string[];
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

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

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
  const recipients: Array<{
    phone?: string;
    email?: string;
    contactId?: string;
    displayName?: string;
    firstName?: string | null;
    lastName?: string | null;
    customFields?: Record<string, unknown> | null;
  }> = [];

  if (listIds.length) {
    const lists = await prisma.contactList.findMany({
      where: { workspaceId, id: { in: listIds } },
    });
    const members = await prisma.contactListMember.findMany({
      where: { listId: { in: listIds } },
    });
    const contactIds = [
      ...new Set(members.map((m: { contactId: string }) => m.contactId).filter(Boolean)),
    ];
    const contacts = contactIds.length
      ? await prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
        })
      : [];
    const contactById = new Map(contacts.map((c: { id: string }) => [c.id, c] as const));
    const membersByList = new Map<string, Array<{ contactId: string }>>();
    for (const member of members) {
      const arr = membersByList.get(member.listId) || [];
      arr.push(member);
      membersByList.set(member.listId, arr);
    }
    for (const list of lists) {
      listNames.push(list.name);
      for (const member of membersByList.get(list.id) || []) {
        const c = contactById.get(member.contactId) as
          | {
              id: string;
              phone: string;
              email?: string | null;
              firstName?: string | null;
              lastName?: string | null;
              customFields?: unknown;
            }
          | undefined;
        if (!c?.phone) continue;
        recipients.push({
          phone: c.phone,
          email: c.email || undefined,
          contactId: c.id,
          displayName: [c.firstName, c.lastName].filter(Boolean).join(" ") || undefined,
          firstName: c.firstName,
          lastName: c.lastName,
          customFields:
            c.customFields && typeof c.customFields === "object"
              ? (c.customFields as Record<string, unknown>)
              : null,
        });
      }
    }
  } else {
    const enrolled = await prisma.campaignRecipient.findMany({
      where: { campaignId, workspaceId },
      select: { phone: true, email: true, contactId: true, displayName: true },
    });
    const contactIds = enrolled.map((r: { contactId: string | null }) => r.contactId).filter(Boolean) as string[];
    const contacts = contactIds.length
      ? await prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true, customFields: true },
        })
      : [];
    type ContactRow = {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      customFields?: unknown;
    };
    const byId = new Map<string, ContactRow>(
      (contacts as ContactRow[]).map((c) => [c.id, c]),
    );
    for (const r of enrolled) {
      const contact = r.contactId ? byId.get(r.contactId) : undefined;
      recipients.push({
        phone: r.phone || undefined,
        email: r.email || undefined,
        contactId: r.contactId || undefined,
        displayName: r.displayName || undefined,
        firstName: contact?.firstName,
        lastName: contact?.lastName,
        customFields:
          contact?.customFields && typeof contact.customFields === "object"
            ? (contact.customFields as Record<string, unknown>)
            : null,
      });
    }
  }

  const rawContactCount = recipients.length;
  const { accepted, rejected } = await validateBulkRecipients(workspaceId, campaignId, recipients);

  const duplicateRemoved = rejected.filter((r) => r.reason === "duplicate_in_batch").length;
  const invalidRemoved = rejected.filter((r) => r.reason === "invalid_phone" || r.reason === "missing_address").length;
  const suppressedRemoved = rejected.filter((r) => r.reason === "suppressed").length;

  const body = campaign.body || "";
  const sequence = parseSequence(campaign.sequenceJson);
  const smsSteps = sequence.filter((s) => s.step_type === "send_sms");
  const stepsToPrice = smsSteps.length
    ? smsSteps
    : [{ step_key: "sms_1", step_type: "send_sms" as const, config: { body } }];
  const sequenceForMedia = smsSteps.length ? sequence : undefined;
  const mmsStepCount = stepsToPrice.filter(
    (step) => mediaUrlsForSequenceStep(step, config, sequenceForMedia).length > 0,
  ).length;
  const isMms = mmsStepCount > 0;
  const mmsBlocked = isMms && !MASS_TEXT_MMS_PRODUCTION_ENABLED;

  let estimatedSegments = 0;
  const acceptedByPhone = new Map(accepted.map((r) => [r.phone, r]));
  for (const recipient of recipients) {
    if (!recipient.phone || !acceptedByPhone.has(recipient.phone)) continue;
    const vars = massTextMergeVarsFromContact({
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      displayName: recipient.displayName,
      phone: recipient.phone,
      email: recipient.email,
      businessName: workspace?.name,
      customFields: recipient.customFields,
    });
    for (const step of stepsToPrice) {
      const template = String(step.config?.body || body);
      const stepMedia = mediaUrlsForSequenceStep(step, config, sequenceForMedia);
      const priced = creditsForRecipientBody({
        template,
        isMms: stepMedia.length > 0,
        vars,
      });
      estimatedSegments += priced.credits;
    }
  }

  const { resolveMassTextSendingNumber } = await import("@/lib/mass-texting/messaging-registration");
  const sender = await resolveMassTextSendingNumber(workspaceId);
  const availability = await getSegmentAvailability(workspaceId);
  const canSend = availability.canSend && estimatedSegments <= availability.available && !mmsBlocked;
  const shortage = Math.max(0, estimatedSegments - availability.available);

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
    mmsCount: accepted.length * mmsStepCount,
    messagePreview: body.slice(0, 280),
    phoneNumberId: sender?.phoneNumberId ?? null,
    phoneE164: sender?.phoneE164 ?? null,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    a2pUseCase: "MASS_TEXT_MARKETING",
    availableSegments: availability.available,
    requiredSegments: estimatedSegments,
    shortage,
    canSend,
    blockReason: mmsBlocked
      ? "MMS is not enabled in production yet"
      : shortage > 0
        ? `Need ${estimatedSegments} credits but only ${availability.available} available`
        : availability.blockReason,
    mmsBlocked,
    acceptedPhones: accepted
      .map((r) => r.phone)
      .filter((phone): phone is string => Boolean(phone)),
  };
}
