import "server-only";

import { getPrisma } from "@/lib/db";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { findActivePlatformSenderIdsForConsumer } from "@/lib/mctb/messaging/platform-sender-assignment";
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
 * Appointment Reminders always use the same canonical Telnyx platform toll-free (866)
 * as Missed Call Text Back — never Twilio or a secondary sender pool.
 */
export async function listArEligiblePlatformSenders(): Promise<ArPlatformSenderCandidate[]> {
  const configuredIds = (process.env.AR_PLATFORM_SENDER_PHONE_NUMBER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const canonical = await resolveCanonicalMctbPlatformSender();
  if (!canonical?.e164) {
    return [];
  }

  const provider = String(canonical.provider || "").toLowerCase();
  if (provider !== "telnyx") {
    return [];
  }

  if (configuredIds.length && !configuredIds.includes(canonical.phoneNumberId)) {
    return [];
  }

  const auth = await isPhoneAuthorizedForOutboundSms(canonical.phoneNumberId);
  if (!auth.allowed) {
    return [];
  }

  return [
    {
      phoneNumberId: canonical.phoneNumberId,
      e164: canonical.e164,
      workspaceId: canonical.workspaceId,
      provider: "telnyx",
      priority: 1,
    },
  ];
}

export async function findOccupiedArSenderIdsForConsumer(consumerE164: string): Promise<Set<string>> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(consumerE164);
  const rows = await prisma.arSmsReplySession.findMany({
    where: {
      consumerE164: consumer,
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
    },
    select: { platformPhoneNumberId: true, appointmentId: true },
  });
  return new Set(rows.map((r) => r.platformPhoneNumberId));
}

/** Senders occupied by active AR sessions or active MCTB platform assignments for this consumer. */
export async function findOccupiedPlatformSenderIdsForConsumer(
  consumerE164: string,
): Promise<Set<string>> {
  const consumer = normalizeMctbCallerE164(consumerE164);
  const [arOccupied, mctbOccupied] = await Promise.all([
    findOccupiedArSenderIdsForConsumer(consumer),
    findActivePlatformSenderIdsForConsumer(consumer),
  ]);
  return new Set([...arOccupied, ...mctbOccupied]);
}

export { pickFirstUnoccupiedPlatformSender } from "./ar-platform-sender-selection";

export { AR_REPLY_ELIGIBLE_STATES };
