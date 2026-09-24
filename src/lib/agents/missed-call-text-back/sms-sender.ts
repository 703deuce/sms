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

function hasExplicitWorkspaceSmsSender(
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">,
): boolean {
  return Boolean(config.smsPhoneNumberId?.trim());
}

/**
 * Resolve workspace-owned SMS sender (PLATFORM mode uses platform-sender-config instead).
 *
 * WORKSPACE semantics:
 * - Explicit `smsPhoneNumberId` wins over ingress `phoneNumberId` (intentional outbound sender).
 * - Legacy rows without explicit SMS sender: ingress first, then SMS id (unchanged behavior).
 */
export async function resolveMctbSmsSender(input: {
  workspaceId: string;
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">;
}): Promise<MctbSmsSender | null> {
  const explicitSms = hasExplicitWorkspaceSmsSender(input.config);

  if (explicitSms) {
    const fromSms = await resolveConfiguredMctbPhoneForWorkspace(
      input.workspaceId,
      input.config.smsPhoneNumberId,
    );
    if (fromSms) {
      return { ...fromSms, source: "sms_phone_number_id" };
    }
  }

  const fromVoice = await resolveConfiguredMctbPhoneForWorkspace(
    input.workspaceId,
    input.config.phoneNumberId,
  );
  if (fromVoice) {
    return { ...fromVoice, source: "phone_number_id" };
  }

  if (!explicitSms) {
    const fromSms = await resolveConfiguredMctbPhoneForWorkspace(
      input.workspaceId,
      input.config.smsPhoneNumberId,
    );
    if (fromSms) {
      return { ...fromSms, source: "sms_phone_number_id" };
    }
  }

  return null;
}
