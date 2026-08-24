import { getLiveKitSipClient, getLiveKitSipClientForCall } from "@/lib/telephony/provisioning/livekit/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { MediaBackend } from "@/lib/voice/media-backend/types";

export async function transferLiveKitSipParticipant(input: {
  roomName: string;
  participantIdentity: string;
  destinationE164: string;
  playDialtone?: boolean;
  callId?: string;
  mediaBackend?: MediaBackend;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const client = input.callId
      ? await getLiveKitSipClientForCall(input.callId)
      : getLiveKitSipClient(input.mediaBackend);
    const transferTo = input.destinationE164.startsWith("sip:")
      ? input.destinationE164
      : `tel:${normalizeE164(input.destinationE164)}`;
    await client.transferSipParticipant(
      input.roomName,
      input.participantIdentity,
      transferTo,
      { playDialtone: input.playDialtone ?? true },
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
