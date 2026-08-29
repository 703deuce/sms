/**
 * Keyword opt-in / automation runtime.
 */

import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/**
 * Record a contest entry when an inbound message's first word matches an active
 * contest keyword. Creates/updates a subscribed contact and dedupes by phone.
 */
export async function recordContestEntryIfMatch(input: {
  workspaceId: string;
  from: string;
  body: string;
}): Promise<{ matched: boolean; replyText?: string; contestId?: string }> {
  const prisma = getPrisma();
  const word = (input.body || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
  if (!word) return { matched: false };

  const now = new Date();
  const contests = await prisma.contest.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "active",
      keywordText: { equals: word, mode: "insensitive" },
    },
  });
  const contest = (contests as Array<{ startAt: Date | null; endAt: Date | null } & Record<string, any>>).find((c) => {
    if (c.startAt && c.startAt > now) return false;
    if (c.endAt && c.endAt < now) return false;
    return true;
  });
  if (!contest) return { matched: false };

  let from = input.from;
  try {
    from = normalizeE164(input.from);
  } catch {
    // keep
  }

  // Enforce max entries when configured.
  if (contest.maxEntries != null) {
    const count = await prisma.contestEntry.count({ where: { contestId: contest.id } });
    const already = await prisma.contestEntry.findFirst({
      where: { contestId: contest.id, phone: from },
    });
    if (!already && count >= contest.maxEntries) {
      return {
        matched: true,
        contestId: contest.id,
        replyText: "This contest has reached its entry limit. Thanks for your interest!",
      };
    }
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone: from,
        status: "SUBSCRIBED",
        consentSource: `contest:${contest.keywordText}`,
        consentDate: new Date(),
      },
    });
  }

  let created = false;
  try {
    await prisma.contestEntry.create({
      data: {
        contestId: contest.id,
        contactId: contact.id,
        phone: from,
      },
    });
    created = true;
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
    // Already entered — dedupe on [contestId, phone].
  }

  const replyText = created
    ? `You're entered in ${contest.name}! ${contest.prizeDescription ? `Prize: ${contest.prizeDescription}. ` : ""}Reply STOP to opt out.`.trim()
    : `You're already entered in ${contest.name}. Good luck!`;

  return { matched: true, contestId: contest.id, replyText };
}

export async function handleKeywordInbound(input: {
  workspaceId: string;
  from: string;
  to: string;
  body: string;
}): Promise<{ matched: boolean; replyText?: string; keyword?: string }> {
  const prisma = getPrisma();
  const word = (input.body || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
  if (!word) return { matched: false };

  // Defer compliance keywords to inbound-process (workspace-configurable lists).
  const {
    getMessagingRuntimeSettings,
    parseKeywordList,
    DEFAULT_OPT_OUT_KEYWORDS,
    DEFAULT_OPT_IN_KEYWORDS,
    DEFAULT_HELP_KEYWORDS,
  } = await import("@/lib/messaging/messaging-settings");
  const settings = await getMessagingRuntimeSettings(input.workspaceId);
  const reserved = new Set([
    ...parseKeywordList(settings.optOutKeywords, DEFAULT_OPT_OUT_KEYWORDS),
    ...parseKeywordList(settings.optInKeywords, DEFAULT_OPT_IN_KEYWORDS),
    ...parseKeywordList(settings.helpKeywords, DEFAULT_HELP_KEYWORDS),
  ]);
  if (reserved.has(word)) {
    return { matched: false };
  }

  let to = input.to;
  try {
    to = normalizeE164(input.to);
  } catch {
    // keep
  }

  const keyword = await prisma.keyword.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: "Active",
      keyword: { equals: word, mode: "insensitive" },
      OR: [{ phoneNumber: to }, { phoneNumber: input.to }, { phoneNumber: "*" }],
    },
  });
  if (!keyword) return { matched: false };

  let from = input.from;
  try {
    from = normalizeE164(input.from);
  } catch {
    // keep
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });
  const isNewContact = !contact;
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone: from,
        status: "SUBSCRIBED",
        consentSource: `keyword:${keyword.keyword}`,
        consentDate: new Date(),
      },
    });
  } else if (contact.status !== "SUBSCRIBED") {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "SUBSCRIBED", consentSource: `keyword:${keyword.keyword}`, consentDate: new Date() },
    });
  }

  await prisma.consentRecord.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: contact.id,
      phone: from,
      consentDate: new Date(),
      source: `keyword:${keyword.keyword}`,
      disclosureVersion: "keyword-v1",
      disclosureText: keyword.confirmation,
    },
  });

  // Ensure list membership when listName is set
  let joinedListId: string | null = null;
  if (keyword.listName) {
    let list = await prisma.contactList.findFirst({
      where: { workspaceId: input.workspaceId, name: keyword.listName },
    });
    if (!list) {
      list = await prisma.contactList.create({
        data: { workspaceId: input.workspaceId, name: keyword.listName },
      });
    }
    joinedListId = list.id;
    try {
      await prisma.contactListMember.create({
        data: { listId: list.id, contactId: contact.id },
      });
      const { emitAutomationEvent } = await import("@/lib/automations/events");
      await emitAutomationEvent(input.workspaceId, "list.member_added", contact.id, {
        listId: list.id,
      }).catch(() => undefined);
      const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
      await dispatchAutoReplies({
        workspaceId: input.workspaceId,
        contactId: contact.id,
        triggerType: "list_join",
        listId: list.id,
      }).catch(() => undefined);
      const { triggerDripCampaigns } = await import("@/lib/drip-campaigns/engine");
      await triggerDripCampaigns({
        workspaceId: input.workspaceId,
        contactId: contact.id,
        triggerType: "list_join",
        listId: list.id,
      }).catch(() => undefined);
    } catch {
      // already a member
    }
  }

  if (isNewContact) {
    const { fireContactAddedAutomations } = await import("@/lib/automate/contact-added-triggers");
    await fireContactAddedAutomations(input.workspaceId, contact.id, {
      fromE164: to,
      consentSource: `keyword:${keyword.keyword}`,
    }).catch(() => undefined);
  }

  const tags = Array.isArray(keyword.tagsJson) ? (keyword.tagsJson as string[]) : [];
  for (const tagName of tags) {
    if (!tagName) continue;
    let tag = await prisma.tag.findFirst({
      where: { workspaceId: input.workspaceId, name: String(tagName) },
    });
    if (!tag) {
      tag = await prisma.tag.create({
        data: { workspaceId: input.workspaceId, name: String(tagName) },
      });
    }
    try {
      await prisma.contactTag.create({ data: { tagId: tag.id, contactId: contact.id } });
    } catch {
      // already tagged
    }
  }

  if (keyword.startCampaignId) {
    try {
      await enrollContactInCampaign({
        workspaceId: input.workspaceId,
        campaignId: keyword.startCampaignId,
        phone: from,
        contactId: contact.id,
        metadata: { source: "keyword", keyword: keyword.keyword },
      });
    } catch (err) {
      console.error("[keyword] enroll failed", err);
    }
  }

  await prisma.keyword.update({
    where: { id: keyword.id },
    data: { subscribers: { increment: 1 } },
  });

  const { recordTapToJoinJoin } = await import("@/lib/growth/tap-to-join");
  await recordTapToJoinJoin(input.workspaceId, keyword.id).catch(() => undefined);

  return {
    matched: true,
    keyword: keyword.keyword,
    replyText: keyword.autoReply || keyword.confirmation || undefined,
  };
}
