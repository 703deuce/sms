import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady } from "@/lib/messaging/status";
import type { MissedCallTextConfigRecord } from "./types";

export type MctbSmsSender = {
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id" | "messaging_registration" | "phone_number_id";
};

/**
 * Resolve the SMS-capable sender for John MCTB.
 * Voice may ring on a toll-free (866); texts must go out from the A2P-registered local DID (571).
 */
export async function resolveMctbSmsSender(input: {
  workspaceId: string;
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">;
}): Promise<MctbSmsSender | null> {
  const prisma = getPrisma();

  const tryPhoneId = async (
    phoneNumberId: string | null | undefined,
    source: MctbSmsSender["source"],
  ): Promise<MctbSmsSender | null> => {
    if (!phoneNumberId) return null;
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId: input.workspaceId },
      select: { id: true, e164: true },
    });
    if (!pn?.e164) return null;
    return { phoneNumberId: pn.id, e164: pn.e164, source };
  };

  const explicit = await tryPhoneId(input.config.smsPhoneNumberId, "sms_phone_number_id");
  if (explicit) return explicit;

  const reg = await getRegistrationByWorkspace(input.workspaceId);
  if (reg?.phoneE164 && isMessagingReady(reg)) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId: input.workspaceId, e164: reg.phoneE164 },
      select: { id: true, e164: true },
    });
    if (pn) {
      return { phoneNumberId: pn.id, e164: pn.e164, source: "messaging_registration" };
    }
    return {
      phoneNumberId: input.config.smsPhoneNumberId || input.config.phoneNumberId || "messaging_reg",
      e164: reg.phoneE164,
      source: "messaging_registration",
    };
  }

  return tryPhoneId(input.config.phoneNumberId, "phone_number_id");
}
