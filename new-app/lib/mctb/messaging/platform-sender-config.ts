import "server-only";

import { getPrisma } from "@/lib/server/db";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/mctb/messaging/phone-number-class";

export type CanonicalMctbPlatformSender = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  provider: string;
};

function configuredPlatformSenderPhoneNumberId(): string | null {
  const raw = process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID?.trim();
  return raw || null;
}

/**
 * Resolve the canonical Transovo MCTB platform SMS sender (not the customer's voice DID).
 */
export async function resolveCanonicalMctbPlatformSender(): Promise<CanonicalMctbPlatformSender | null> {
  const envFrom = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  const envId = process.env.VOICE_OUTBOUND_SMS_PHONE_NUMBER_ID?.trim();
  if (envFrom && envId) {
    return {
      phoneNumberId: envId,
      e164: envFrom,
      workspaceId: process.env.MCTB_PLATFORM_SENDER_WORKSPACE_ID?.trim() || "platform",
      provider: "telnyx",
    };
  }

  const prisma = getPrisma();
  const byId = configuredPlatformSenderPhoneNumberId();
  if (byId) {
    const row = await prisma.phoneNumber.findFirst({
      where: { id: byId, status: "Active" },
      select: { id: true, e164: true, workspaceId: true, provider: true, settingsJson: true },
    });
    if (row?.e164 && isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson })) {
      return {
        phoneNumberId: row.id,
        e164: row.e164,
        workspaceId: row.workspaceId,
        provider: String(row.provider || "").toLowerCase() || "twilio",
      };
    }
  }

  const candidates = await prisma.phoneNumber.findMany({
    where: { status: "Active" },
    select: { id: true, e164: true, workspaceId: true, provider: true, settingsJson: true },
    take: 50,
  });
  const platformRows = candidates.filter((row) =>
    isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson }),
  );
  if (platformRows.length !== 1) {
    return null;
  }
  const row = platformRows[0]!;
  if (!row.e164) return null;
  return {
    phoneNumberId: row.id,
    e164: row.e164,
    workspaceId: row.workspaceId,
    provider: String(row.provider || "").toLowerCase() || "twilio",
  };
}
