import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export function getRealtimeBridgeListenPort(): number {
  const raw = process.env.VOICE_REALTIME_BRIDGE_PORT?.trim() || "3108";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 3108;
}

/** Public WSS base Telnyx will connect to (must be reachable from Telnyx). */
export function getRealtimeBridgePublicWssBase(): string {
  const explicit = process.env.VOICE_REALTIME_BRIDGE_PUBLIC_WSS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const app = getAppBaseUrl().replace(/\/$/, "");
  const port = getRealtimeBridgeListenPort();
  const wsOrigin = app.replace(/^http/i, "ws");
  if (wsOrigin.includes("localhost") || wsOrigin.includes("127.0.0.1")) {
    return `${wsOrigin.split(":").slice(0, 2).join(":")}:${port}`;
  }
  return `${wsOrigin}:${port}`;
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
