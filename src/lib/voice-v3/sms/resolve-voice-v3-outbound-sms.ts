import "server-only";

import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import { resolveVoiceOutboundSmsFrom } from "@/lib/voice/sms/voice-outbound-sms-from";
import type { VoiceV3AgentConfig } from "../config/agent-config";

export type VoiceV3OutboundSmsResolution = {
  fromE164: string;
  phoneNumberId: string | null;
};

/** Canonical outbound SMS sender for Voice V3 (booking link, booking confirmation, recovery). */
export async function resolveVoiceV3OutboundSms(input: {
  workspaceId: string;
  agentId?: string | null;
  config: VoiceV3AgentConfig;
}): Promise<VoiceV3OutboundSmsResolution | null> {
  const tel = input.config.telephony;
  const explicit = normalizePhoneE164(tel?.outboundSmsE164);
  if (explicit) {
    return {
      fromE164: explicit,
      phoneNumberId: tel?.outboundSmsPhoneNumberId?.trim() || null,
    };
  }

  if (tel?.outboundSmsMode === "same_as_voice_line") {
    const voiceDid = normalizePhoneE164(tel?.phoneNumberE164);
    if (voiceDid) {
      return {
        fromE164: voiceDid,
        phoneNumberId: tel?.phoneNumberId?.trim() || null,
      };
    }
  }

  const fromE164 = await resolveVoiceOutboundSmsFrom({
    workspaceId: input.workspaceId,
    calledE164: tel?.phoneNumberE164 ?? null,
    agentId: input.agentId,
    config: null,
  });
  if (!fromE164) return null;
  return {
    fromE164,
    phoneNumberId: tel?.outboundSmsPhoneNumberId?.trim() || null,
  };
}
