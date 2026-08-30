import { getPrisma } from "@/lib/db";
import type { MissedCallTextConfigRecord } from "./types";

export type MctbSmsSender = {
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id" | "phone_number_id";
};

/**
 * Resolve a workspace-owned phone number saved in MCTB setup.
 */
export async function resolveConfiguredMctbPhoneForWorkspace(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<{ phoneNumberId: string; e164: string } | null> {
  if (!phoneNumberId) return null;

  const prisma = getPrisma();
  const owned = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { id: true, e164: true },
  });
  if (owned?.e164) {
    return { phoneNumberId: owned.id, e164: owned.e164 };
  }

  return null;
}

/**
 * Resolve the SMS sender for MCTB using only numbers saved in setup config.
 * Production: the voice/setup DID is the primary sender (`phoneNumberId` wins).
 */
export async function resolveMctbSmsSender(input: {
  workspaceId: string;
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">;
}): Promise<MctbSmsSender | null> {
  const fromVoice = await resolveConfiguredMctbPhoneForWorkspace(
    input.workspaceId,
    input.config.phoneNumberId,
  );
  if (fromVoice) {
    return { ...fromVoice, source: "phone_number_id" };
  }

  const fromSms = await resolveConfiguredMctbPhoneForWorkspace(
    input.workspaceId,
    input.config.smsPhoneNumberId,
  );
  if (fromSms) {
    return { ...fromSms, source: "sms_phone_number_id" };
  }

  return null;
}
