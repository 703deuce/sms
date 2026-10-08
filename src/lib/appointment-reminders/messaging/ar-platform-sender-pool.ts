import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isPlatformMctbSenderPhoneRecord,
  isPreservedTwilioPlatformMctbSenderRecord,
} from "@/lib/messaging/compliance/phone-number-class";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";

import {
  pickFirstUnoccupiedPlatformSender,
  type ArPlatformSenderCandidate,
} from "./ar-platform-sender-selection";

export type { ArPlatformSenderCandidate };

const AR_REPLY_ELIGIBLE_STATES = [
  "AWAITING_REPLY",
  "RESCHEDULING",
  "AWAITING_CANCEL_CONFIRM",
  "AWAITING_STAFF_APPROVAL",
] as const;

/**
 * Telnyx 866 (canonical platform sender) first; preserved Twilio platform sender as overflow
 * when the same customer already has a reply-eligible AR conversation on Telnyx.
 */
export async function listArEligiblePlatformSenders(): Promise<ArPlatformSenderCandidate[]> {
  const configuredIds = (process.env.AR_PLATFORM_SENDER_PHONE_NUMBER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const candidates: ArPlatformSenderCandidate[] = [];

  const canonical = await resolveCanonicalMctbPlatformSender();
  if (canonical?.e164 && String(canonical.provider || "").toLowerCase() === "telnyx") {
    if (!configuredIds.length || configuredIds.includes(canonical.phoneNumberId)) {
      const auth = await isPhoneAuthorizedForOutboundSms(canonical.phoneNumberId);
      if (auth.allowed) {
        candidates.push({
          phoneNumberId: canonical.phoneNumberId,
          e164: canonical.e164,
          workspaceId: canonical.workspaceId,
          provider: "telnyx",
          priority: 1,
        });
      }
    }
  }

  const prisma = getPrisma();
  const rows = await prisma.phoneNumber.findMany({
    where: { status: "Active" },
    select: { id: true, e164: true, workspaceId: true, provider: true, settingsJson: true },
    take: 80,
  });

  for (const row of rows) {
    if (!row.e164) continue;
    if (!isPreservedTwilioPlatformMctbSenderRecord({ settingsJson: row.settingsJson })) {
      continue;
    }
    if (configuredIds.length && !configuredIds.includes(row.id)) continue;
    const auth = await isPhoneAuthorizedForOutboundSms(row.id);
    if (!auth.allowed) continue;
    candidates.push({
      phoneNumberId: row.id,
      e164: row.e164,
      workspaceId: row.workspaceId,
      provider: "twilio",
      priority: 2,
    });
  }

  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      if (seen.has(c.phoneNumberId)) return false;
      seen.add(c.phoneNumberId);
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Platform senders already assigned to this customer (durable AR assignments).
 * @deprecated Prefer findArPlatformSendersOccupiedByOtherWorkspaces for allocation.
 */
export async function findOccupiedArSenderIdsForConsumer(consumerE164: string): Promise<Set<string>> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(consumerE164);
  const rows = await prisma.arSmsConsumerPlatformSenderAssignment.findMany({
    where: { consumerE164: consumer },
    select: { platformPhoneNumberId: true },
  });
  return new Set(rows.map((r) => r.platformPhoneNumberId));
}

export { pickFirstUnoccupiedPlatformSender } from "./ar-platform-sender-selection";

export { AR_REPLY_ELIGIBLE_STATES };
