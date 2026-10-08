import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isPlatformMctbSenderPhoneRecord,
  isPreservedTwilioPlatformMctbSenderRecord,
} from "@/lib/messaging/compliance/phone-number-class";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { findActivePlatformSenderIdsForConsumer } from "@/lib/mctb/messaging/platform-sender-assignment";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";

export type ArPlatformSenderCandidate = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  provider: "telnyx" | "twilio";
  priority: number;
};

const AR_REPLY_ELIGIBLE_STATES = [
  "AWAITING_REPLY",
  "RESCHEDULING",
  "AWAITING_CANCEL_CONFIRM",
  "AWAITING_STAFF_APPROVAL",
] as const;

export async function listArEligiblePlatformSenders(): Promise<ArPlatformSenderCandidate[]> {
  const prisma = getPrisma();
  const configuredIds = (process.env.AR_PLATFORM_SENDER_PHONE_NUMBER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = await prisma.phoneNumber.findMany({
    where: { status: "Active" },
    select: { id: true, e164: true, workspaceId: true, provider: true, settingsJson: true },
    take: 80,
  });

  const candidates: ArPlatformSenderCandidate[] = [];
  for (const row of rows) {
    if (!row.e164) continue;
    const isPlatform =
      isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson }) ||
      isPreservedTwilioPlatformMctbSenderRecord({ settingsJson: row.settingsJson });
    if (!isPlatform) continue;
    if (configuredIds.length && !configuredIds.includes(row.id)) continue;

    const provider = String(row.provider || "").toLowerCase() === "twilio" ? "twilio" : "telnyx";
    const auth = await isPhoneAuthorizedForOutboundSms(row.id);
    if (!auth.allowed) continue;

    const priority =
      provider === "telnyx"
        ? 1
        : isPreservedTwilioPlatformMctbSenderRecord({ settingsJson: row.settingsJson })
          ? 2
          : 3;
    candidates.push({
      phoneNumberId: row.id,
      e164: row.e164,
      workspaceId: row.workspaceId,
      provider,
      priority,
    });
  }

  if (!candidates.length) {
    const canonical = await resolveCanonicalMctbPlatformSender();
    if (canonical?.e164) {
      const auth = await isPhoneAuthorizedForOutboundSms(canonical.phoneNumberId);
      if (auth.allowed) {
        candidates.push({
          phoneNumberId: canonical.phoneNumberId,
          e164: canonical.e164,
          workspaceId: canonical.workspaceId,
          provider: canonical.provider === "twilio" ? "twilio" : "telnyx",
          priority: canonical.provider === "twilio" ? 2 : 1,
        });
      }
    }
  }

  return candidates.sort((a, b) => a.priority - b.priority);
}

export async function findOccupiedArSenderIdsForConsumer(consumerE164: string): Promise<Set<string>> {
  const { getPrisma } = await import("@/lib/db");
  const { normalizeMctbCallerE164 } = await import("@/lib/mctb/messaging/caller-e164");
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

export { AR_REPLY_ELIGIBLE_STATES };
