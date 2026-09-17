import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { LIVEKIT_SELF_HOSTED_WSS_URL } from "@/lib/voice/media-backend/constants";

/** Internal WS listener (Telnyx media connects via Traefik → this port in production). */
export const REALTIME_BRIDGE_LISTEN_PORT = 3108;

export function getRealtimeBridgeListenPort(): number {
  const raw = process.env.VOICE_REALTIME_BRIDGE_PORT?.trim();
  if (!raw) return REALTIME_BRIDGE_LISTEN_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : REALTIME_BRIDGE_LISTEN_PORT;
}

/**
 * Public WSS base Telnyx uses for `streaming_start` (TLS required on PSTN).
 * Production uses the same frozen voice host as self-hosted LiveKit (`voice.transovo.ai`).
 * Local dev uses ws://localhost:{port} when APP_URL is localhost.
 */
export function getRealtimeBridgePublicWssBase(): string {
  const app = getAppBaseUrl().replace(/\/$/, "");
  const wsOrigin = app.replace(/^http/i, "ws");
  if (wsOrigin.includes("localhost") || wsOrigin.includes("127.0.0.1")) {
    const port = getRealtimeBridgeListenPort();
    return `${wsOrigin.split(":").slice(0, 2).join(":")}:${port}`;
  }
  return LIVEKIT_SELF_HOSTED_WSS_URL.replace(/\/$/, "");
}

export function getOpenAiApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function realtimeBridgeSigningSecret(): string {
  return (
    process.env.VOICE_REALTIME_BRIDGE_SIGNING_SECRET?.trim() ||
    process.env.TRANSOVO_INTERNAL_API_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

export function buildTelnyxMediaStreamUrl(token: string): string {
  const base = getRealtimeBridgePublicWssBase();
  return `${base}/telnyx/media?token=${encodeURIComponent(token)}`;
}
