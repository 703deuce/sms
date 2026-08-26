import { getPrisma } from "@/lib/db";
import { isWorkspaceAuthorizedForPlatformDemoNumber } from "@/lib/mctb/platform-demo-access";
import type { MissedCallTextConfigRecord } from "./types";

export type MctbSmsSender = {
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id" | "phone_number_id";
};

/**
 * Resolve a phone number saved in MCTB setup for this workspace.
 * Includes workspace-owned DIDs and platform-demo lines assigned to the workspace.
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

  const authorized = await isWorkspaceAuthorizedForPlatformDemoNumber(workspaceId);
  if (!authorized) return null;

  const linked = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId },
    select: { id: true, e164: true },
  });
  if (linked?.e164) {
    return { phoneNumberId: linked.id, e164: linked.e164 };
  }

  return null;
}

/**
 * Resolve the SMS sender for MCTB using only numbers saved in setup config.
 * Never falls back to messagingRegistration or other workspace inventory.
 */
export async function resolveMctbSmsSender(input: {
  workspaceId: string;
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">;
}): Promise<MctbSmsSender | null> {
  const fromSms = await resolveConfiguredMctbPhoneForWorkspace(
    input.workspaceId,
    input.config.smsPhoneNumberId,
  );
  if (fromSms) {
    return { ...fromSms, source: "sms_phone_number_id" };
  }

  const fromVoice = await resolveConfiguredMctbPhoneForWorkspace(
    input.workspaceId,
    input.config.phoneNumberId,
  );
  if (fromVoice) {
    return { ...fromVoice, source: "phone_number_id" };
  }

  return null;
}
