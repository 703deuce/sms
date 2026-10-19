import "server-only";
import { SipClient } from "livekit-server-sdk";

export function getLiveKitSipClient(): SipClient {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit env missing (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)");
  }
  return new SipClient(url, apiKey, apiSecret);
}

export const VOICE_V3_LIVEKIT_AGENT_NAME =
  process.env.VOICE_V3_LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-v3";

export const TRANSOVO_LIVEKIT_ROOM_PREFIX =
  process.env.LIVEKIT_INBOUND_ROOM_PREFIX?.trim() || "transovo-call-";
