import "server-only";

import { getPrisma } from "@/lib/db";
import { parseCampaignConfig } from "@/lib/mass-texting/broadcast/service";
import { validateBulkRecipients } from "@/lib/campaigns/enroll-campaign";
import { parseSequence } from "@/lib/campaigns/sequence-engine";
import { MASS_TEXT_MMS_PRODUCTION_ENABLED } from "@/lib/mass-texting/pricing";
import { creditsForRecipientBody, massTextMergeVarsFromContact } from "@/lib/mass-texting/personalization";
import { getSegmentAvailability } from "@/lib/mass-texting/credit-accounting";
import { mediaUrlsForSequenceStep, mediaUrlsFromCampaignConfig } from "@/lib/mass-texting/mms";

const REVIEW_SEGMENT_SAMPLE = 25;

/** Local review gate — DB only. No Telnyx/provider sync on the review screen. */
async function resolveReviewCreditsGate(
  workspaceId: string,
  configNumberId: string | undefined,
  estimatedSegments: number,
  mmsBlocked: boolean,
) {
  const availability = await getSegmentAvailability(workspaceId);
  const { resolveMassTextSendingNumber } = await import("@/lib/mass-texting/messaging-registration");
  const { getRegistrationByWorkspace } = await import("@/lib/messaging/store");

  const sender = await resolveMassTextSendingNumber(workspaceId, configNumberId);
  const reg = await getRegistrationByWorkspace(workspaceId);
  const shortage = Math.max(0, estimatedSegments - availability.available);
  /** Review screen: credits math only — launch enforces A2P/sender separately. */
  const canSend =
    availability.canSend && estimatedSegments <= availability.available && !mmsBlocked;

  const blockReason = mmsBlocked
    ? "MMS is not enabled in production yet"
    : shortage > 0
      ? `Need ${estimatedSegments} credits but only ${availability.available} available`
      : !availability.canSend
        ? availability.blockReason
        : null;

  return {
    availability,
    sender,
    canSend,
    shortage,
    blockReason,
    useCase: String(reg?.useCase || "MIXED"),
  };
}

type ReviewRecipient = {
  phone?: string;
  email?: string;
  contactId?: string;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  customFields?: Record<string, unknown> | null;
};

function estimateCreditsForRecipients(input: {
  body: string;
  config: Record<string, unknown>;
  sequenceJson: unknown;
  workspaceName?: string | null;
  recipients: ReviewRecipient[];
  eligibleTotal: number;
  acceptedPhones: Set<string>;
}): { estimatedSegments: number; mmsStepCount: number; mmsBlocked: boolean } {
  const sequence = parseSequence(input.sequenceJson);
  const smsSteps = sequence.filter((s) => s.step_type === "send_sms");
  const stepsToPrice = smsSteps.length
    ? smsSteps
    : [{ step_key: "sms_1", step_type: "send_sms" as const, config: { body: input.body } }];
  const sequenceForMedia = smsSteps.length ? sequence : undefined;
  const mmsStepCount = stepsToPrice.filter(
    (step) => mediaUrlsForSequenceStep(step, input.config, sequenceForMedia).length > 0,
  ).length;
  const isMms = mmsStepCount > 0;
  const mmsBlocked = isMms && !MASS_TEXT_MMS_PRODUCTION_ENABLED;

  const pricedRecipients = input.recipients.filter(
    (r) => r.phone && input.acceptedPhones.has(r.phone),
  );
  const sample = pricedRecipients.slice(0, REVIEW_SEGMENT_SAMPLE);
  let estimatedSegments = 0;

  for (const recipient of sample) {
    const vars = massTextMergeVarsFromContact({
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      displayName: recipient.displayName,
      phone: recipient.phone,
      email: recipient.email,
      businessName: input.workspaceName,
      customFields: recipient.customFields,
    });
    for (const step of stepsToPrice) {
      const template = String(step.config?.body || input.body);
      const stepMedia = mediaUrlsForSequenceStep(step, input.config, sequenceForMedia);
      const priced = creditsForRecipientBody({
        template,
        isMms: stepMedia.length > 0,
        vars,
      });
      estimatedSegments += priced.credits;
    }
  }

  const pricedCount = sample.length;
  const totalRecipients = Math.max(input.eligibleTotal, pricedCount);
  if (pricedCount > 0 && totalRecipients > pricedCount) {
    estimatedSegments = Math.ceil((estimatedSegments / pricedCount) * totalRecipients);
  }

  return { estimatedSegments, mmsStepCount, mmsBlocked };
}

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
  mediaUrls: string[];
  phoneNumberId: string | null;
  phoneE164: string | null;
  scheduledAt: string | null;
  timezone: string | null;
  a2pUseCase: string;
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

  const config = parseCampaignConfig(campaign.configJson) ?? {};
  const scheduleTimezone =
    typeof config.timezone === "string" && config.timezone.trim() ? config.timezone : null;

  const { isBroadcastCampaign } = await import("@/lib/mass-texting/broadcast/service");
  const { previewBroadcastAudience, audienceSummaryLabel } = await import(
    "@/lib/mass-texting/broadcast/audience"
  );

  if (isBroadcastCampaign(config) && config.audience) {
    const audience = config.audience as import("@/lib/mass-texting/broadcast/types").BroadcastAudienceDefinition;
    const preview = await previewBroadcastAudience(workspaceId, audience, campaignId);
    type ContactRow = {
      id: string;
      firstName: string | null;
      lastName: string | null;
      customFields: unknown;
      phone: string;
      email: string | null;
    };
    const enrolled = await prisma.campaignRecipient.findMany({
      where: { campaignId, workspaceId },
      select: { phone: true, email: true, contactId: true, displayName: true },
    });
    const contactIds = enrolled
      .map((r: (typeof enrolled)[number]) => r.contactId)
      .filter(Boolean) as string[];
    const contacts: ContactRow[] = contactIds.length
      ? await prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
        })
      : preview.eligibleSample.length
        ? await prisma.contact.findMany({
            where: { workspaceId, id: { in: preview.eligibleSample.map((s) => s.contactId) } },
          })
        : [];
    const byId = new Map<string, ContactRow>(contacts.map((c) => [c.id, c]));
    const recipients: Array<{
      phone?: string;
      email?: string;
      contactId?: string;
      displayName?: string;
      firstName?: string | null;
      lastName?: string | null;
      customFields?: Record<string, unknown> | null;
    }> = [];
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
    if (!recipients.length) {
      for (const sample of preview.eligibleSample) {
        const contact = byId.get(sample.contactId);
        recipients.push({
          phone: sample.phone,
          contactId: sample.contactId,
          displayName: sample.name,
          firstName: contact?.firstName,
          lastName: contact?.lastName,
          customFields:
            contact?.customFields && typeof contact.customFields === "object"
              ? (contact.customFields as Record<string, unknown>)
              : null,
        });
      }
    }
    const listNames = [audienceSummaryLabel(audience)];
    const rawContactCount = preview.selectedCount;
    const duplicateRemoved = preview.duplicateRemoved + preview.excludedCount;
    const invalidRemoved = preview.invalidRemoved;
    const suppressedRemoved = preview.suppressedRemoved;
    // Enrolled rows are already on this campaign — don't treat as "already_enrolled" rejects.
    const validationCampaignId = enrolled.length > 0 ? null : campaignId;
    const { accepted, rejected } = await validateBulkRecipients(
      workspaceId,
      validationCampaignId,
      recipients,
    );
    void rejected;
    const body = campaign.body || "";
    const eligibleTotal = enrolled.length > 0 ? accepted.length : preview.eligibleCount || accepted.length;
    const acceptedPhones = new Set(
      accepted.map((r) => r.phone).filter((phone): phone is string => Boolean(phone)),
    );
    const creditEstimate = estimateCreditsForRecipients({
      body,
      config,
      sequenceJson: campaign.sequenceJson,
      workspaceName: workspace?.name,
      recipients,
      eligibleTotal,
      acceptedPhones,
    });
    const configNumberId =
      typeof config.numberId === "string" && config.numberId ? config.numberId : undefined;
    const gate = await resolveReviewCreditsGate(
      workspaceId,
      configNumberId,
      creditEstimate.estimatedSegments,
      creditEstimate.mmsBlocked,
    );
    return {
      campaignId,
      campaignName: campaign.name,
      listIds: [],
      listNames,
      rawContactCount,
      duplicateRemoved,
      invalidRemoved,
      suppressedRemoved,
      finalRecipientCount: eligibleTotal,
      estimatedSegments: creditEstimate.estimatedSegments,
      mmsCount: accepted.length * creditEstimate.mmsStepCount,
      messagePreview: body.slice(0, 280),
      mediaUrls: mediaUrlsFromCampaignConfig(config),
      phoneNumberId: gate.sender?.phoneNumberId ?? null,
      phoneE164: gate.sender?.phoneE164 ?? null,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      timezone: scheduleTimezone,
      a2pUseCase: gate.useCase,
      availableSegments: gate.availability.available,
      requiredSegments: creditEstimate.estimatedSegments,
      shortage: gate.shortage,
      canSend: gate.canSend,
      blockReason: gate.blockReason,
      mmsBlocked: creditEstimate.mmsBlocked,
      acceptedPhones: [...acceptedPhones],
    };
  }

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
  const validationCampaignId = listIds.length === 0 && recipients.length > 0 ? null : campaignId;
  const { accepted, rejected } = await validateBulkRecipients(
    workspaceId,
    validationCampaignId,
    recipients,
  );

  const duplicateRemoved = rejected.filter((r) => r.reason === "duplicate_in_batch").length;
  const invalidRemoved = rejected.filter((r) => r.reason === "invalid_phone" || r.reason === "missing_address").length;
  const suppressedRemoved = rejected.filter((r) => r.reason === "suppressed").length;

  const body = campaign.body || "";
  const eligibleTotal = accepted.length;
  const acceptedPhones = new Set(
    accepted.map((r) => r.phone).filter((phone): phone is string => Boolean(phone)),
  );
  const creditEstimate = estimateCreditsForRecipients({
    body,
    config,
    sequenceJson: campaign.sequenceJson,
    workspaceName: workspace?.name,
    recipients,
    eligibleTotal,
    acceptedPhones,
  });
  const configNumberId =
    typeof config.numberId === "string" && config.numberId ? config.numberId : undefined;
  const gate = await resolveReviewCreditsGate(
    workspaceId,
    configNumberId,
    creditEstimate.estimatedSegments,
    creditEstimate.mmsBlocked,
  );

  return {
    campaignId,
    campaignName: campaign.name,
    listIds,
    listNames,
    rawContactCount,
    duplicateRemoved,
    invalidRemoved,
    suppressedRemoved,
    finalRecipientCount: eligibleTotal,
    estimatedSegments: creditEstimate.estimatedSegments,
    mmsCount: accepted.length * creditEstimate.mmsStepCount,
    messagePreview: body.slice(0, 280),
    mediaUrls: mediaUrlsFromCampaignConfig(config),
    phoneNumberId: gate.sender?.phoneNumberId ?? null,
    phoneE164: gate.sender?.phoneE164 ?? null,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    timezone: scheduleTimezone,
    a2pUseCase: gate.useCase,
    availableSegments: gate.availability.available,
    requiredSegments: creditEstimate.estimatedSegments,
    shortage: gate.shortage,
    canSend: gate.canSend,
    blockReason: gate.blockReason,
    mmsBlocked: creditEstimate.mmsBlocked,
    acceptedPhones: [...acceptedPhones],
  };
}
