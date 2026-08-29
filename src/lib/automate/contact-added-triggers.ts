import "server-only";

import { getPrisma } from "@/lib/db";
import { dispatchAutoReplies, type AutoReplyDispatchResult } from "@/lib/auto-replies/dispatch";
import { triggerDripCampaigns } from "@/lib/drip-campaigns/engine";

const FIRED_KEY = "contactAddedAutomationsAt";

type ExistingContact = {
  id: string;
  customFields: unknown;
  consentSource: string | null;
};

export function contactAddedAutomationsAlreadyFired(customFields: unknown): boolean {
  if (!customFields || typeof customFields !== "object") return false;
  return Boolean((customFields as Record<string, unknown>)[FIRED_KEY]);
}

/**
 * Decide whether contact_added auto-replies / drips should run.
 * - Brand-new phone: always
 * - Manual/import add of an existing phone (e.g. inbound auto-created): run once if never fired before
 */
export function shouldRunContactAddedAutomations(
  existing: ExistingContact | null,
  consentSource: string,
): boolean {
  if (!existing) return true;
  if (contactAddedAutomationsAlreadyFired(existing.customFields)) return false;
  return consentSource === "manual" || consentSource === "import";
}

export async function resolveAutomateOutboundFrom(workspaceId: string): Promise<string | undefined> {
  const prisma = getPrisma();
  const ownedNumbers = await prisma.phoneNumber.findMany({
    where: { workspaceId, status: "Active" },
  });
  const { pickPreferredSmsSendingNumber } = await import(
    "@/lib/messaging/preferred-sending-number"
  );
  return pickPreferredSmsSendingNumber(ownedNumbers)?.e164;
}

export type ContactAddedAutomationResult = {
  ran: boolean;
  reason?: string;
  autoReply?: AutoReplyDispatchResult;
  dripEnrolled?: number;
  errors: string[];
};

export async function fireContactAddedAutomations(
  workspaceId: string,
  contactId: string,
  opts?: { fromE164?: string; consentSource?: string },
): Promise<ContactAddedAutomationResult> {
  const errors: string[] = [];
  const fromE164 = opts?.fromE164 ?? (await resolveAutomateOutboundFrom(workspaceId));

  let autoReply: AutoReplyDispatchResult = { sent: false, skippedReason: "not_run" };
  try {
    autoReply = await dispatchAutoReplies({
      workspaceId,
      contactId,
      triggerType: "contact_added",
      fromE164,
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "auto_reply_failed");
  }

  let dripEnrolled = 0;
  try {
    dripEnrolled = await triggerDripCampaigns({
      workspaceId,
      contactId,
      triggerType: "contact_added",
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "drip_failed");
  }

  const sentSomething = Boolean(autoReply.sent || dripEnrolled > 0);

  if (sentSomething) {
    const prisma = getPrisma();
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { customFields: true },
    });
    const customFields =
      contact?.customFields && typeof contact.customFields === "object"
        ? { ...(contact.customFields as Record<string, unknown>) }
        : {};
    customFields[FIRED_KEY] = new Date().toISOString();
    await prisma.contact.update({
      where: { id: contactId },
      data: { customFields },
    });
  }

  return {
    ran: true,
    autoReply,
    dripEnrolled,
    errors,
    reason: sentSomething
      ? undefined
      : autoReply.skippedReason || (dripEnrolled === 0 ? "no_matching_campaign_or_already_enrolled" : undefined),
  };
}
