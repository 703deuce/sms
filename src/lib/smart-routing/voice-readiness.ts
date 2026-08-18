import "server-only";

import { getPrisma } from "@/lib/db";
import { resolvePhoneNumberProvider } from "@/lib/numbers/providers/normalize";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";

export type VoiceReadinessResult = {
  provider: "telnyx" | "twilio";
  ready: {
    voice: boolean;
    outbound?: boolean;
    calls?: boolean;
    messaging?: boolean;
    smsSending?: boolean;
    fully?: boolean;
  };
  errors: string[];
};

export async function diagnoseNumberVoiceReadiness(
  workspaceId: string,
  phoneNumberId: string,
): Promise<VoiceReadinessResult> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!row) {
    return {
      provider: "telnyx",
      ready: { voice: false },
      errors: ["Number not found"],
    };
  }

  const provider = resolvePhoneNumberProvider(row);

  if (provider === "telnyx") {
    const { diagnoseWorkspaceNumber } = await import("@/lib/phone/telnyx-dual-provision");
    const diag = await diagnoseWorkspaceNumber({ workspaceId, phoneNumberId });
    return {
      provider: "telnyx",
      ready: {
        voice: diag.ready.voice,
        outbound: diag.ready.outbound,
        calls: diag.ready.calls,
        messaging: diag.ready.messaging,
        smsSending: diag.ready.smsSending,
        fully: diag.ready.fully,
      },
      errors: diag.errors ?? [],
    };
  }

  const twilioSid = row.twilioSid?.trim() || row.providerNumberId?.trim();
  if (!twilioSid) {
    return {
      provider: "twilio",
      ready: { voice: false, calls: false, fully: false },
      errors: ["Twilio number SID missing"],
    };
  }

  const errors: string[] = [];
  let voiceOk = true;

  try {
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (reg?.subaccountSid && reg.subaccountAuthTokenEnc) {
      const authToken = decryptSecret(reg.subaccountAuthTokenEnc);
      const client = getSubaccountTwilioClient(reg.subaccountSid, authToken);
      const incoming = await client.incomingPhoneNumbers(twilioSid).fetch();
      const base = getAppBaseUrl().replace(/\/$/, "");
      const voiceUrl = incoming.voiceUrl ?? "";
      if (!voiceUrl.includes("/api/webhooks/twilio/voice")) {
        voiceOk = false;
        errors.push("Twilio voice webhook is not pointed at Transovo voice ingress");
      }
    }
  } catch (err) {
    voiceOk = false;
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    provider: "twilio",
    ready: {
      voice: voiceOk,
      calls: voiceOk,
      fully: voiceOk,
    },
    errors,
  };
}
