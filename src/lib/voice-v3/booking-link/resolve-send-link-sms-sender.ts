import "server-only";

import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import { resolveSharedPlatformOutboundSender } from "@/lib/messaging/platform-outbound-sender";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";
import { isPlatformOutboundSmsMode } from "@/lib/voice/sms/voice-outbound-sms-constants";
import { resolveVoiceOutboundSmsFrom } from "@/lib/voice/sms/voice-outbound-sms-from";
import type { VoiceV3AgentConfig } from "../config/agent-config";

export type ResolvedSendLinkSmsSender = {
  fromE164: string;
  phoneNumberId: string;
};

/**
 * Published wizard telephony for SEND_LINK — not LLM, not env default HP sender.
 */
export async function resolveSendLinkSmsSender(input: {
  workspaceId: string;
  agentId?: string | null;
  config: VoiceV3AgentConfig;
}): Promise<ResolvedSendLinkSmsSender | null> {
  const tel = input.config.telephony;
  const mode = tel?.outboundSmsMode;

  const platformSender = async (): Promise<ResolvedSendLinkSmsSender | null> => {
    const platform = await resolveSharedPlatformOutboundSender();
    if (!platform?.fromE164 || !platform.phoneNumberId) return null;
    return {
      fromE164: platform.fromE164,
      phoneNumberId: platform.phoneNumberId,
    };
  };

  if (isBookingLinkOnlyLaunch() || isPlatformOutboundSmsMode(mode)) {
    const platform = await platformSender();
    if (platform) return platform;
  }

  const explicit = normalizePhoneE164(tel?.outboundSmsE164);
  const configuredId = tel?.outboundSmsPhoneNumberId?.trim() || null;
  if (explicit && configuredId) {
    return { fromE164: explicit, phoneNumberId: configuredId };
  }
  if (explicit && !configuredId) {
    return null;
  }

  if (mode === "same_as_voice_line") {
    const voiceDid = normalizePhoneE164(tel?.phoneNumberE164);
    if (voiceDid && configuredId) {
      return { fromE164: voiceDid, phoneNumberId: configuredId };
    }
  }

  const fromE164 = await resolveVoiceOutboundSmsFrom({
    workspaceId: input.workspaceId,
    calledE164: tel?.phoneNumberE164 ?? null,
    agentId: input.agentId,
    config: null,
  });
  if (!fromE164) return null;

  if (configuredId) {
    return { fromE164, phoneNumberId: configuredId };
  }

  return await platformSender();
}
