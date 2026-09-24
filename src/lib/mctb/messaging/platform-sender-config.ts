import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";

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
 * Resolve the single canonical Transovo MCTB platform SMS sender (not per-workspace).
 */
export async function resolveCanonicalMctbPlatformSender(): Promise<CanonicalMctbPlatformSender | null> {
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

export async function isActiveMctbPlatformSenderE164(toRaw: string): Promise<boolean> {
  let toE164 = toRaw.trim();
  try {
    toE164 = normalizeE164(toRaw);
  } catch {
    // keep raw
  }
  const sender = await resolveCanonicalMctbPlatformSender();
  if (!sender) return false;
  try {
    return normalizeE164(sender.e164) === normalizeE164(toE164);
  } catch {
    return sender.e164 === toE164;
  }
}

export function parsePhoneMctbRole(settingsJson: unknown): string | null {
  return parseMctbPhoneRole(settingsJson);
}
