import "server-only";

export const TRANSOVO_LIVEKIT_TRUNK_NAME =
  process.env.LIVEKIT_INBOUND_TRUNK_NAME?.trim() || "transovo-telnyx-inbound";

export const TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME =
  process.env.LIVEKIT_DISPATCH_RULE_NAME?.trim() || "transovo-inbound-dispatch";

export const TRANSOVO_TELNYX_FQDN_CONNECTION_NAME =
  process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_NAME?.trim() || "Transovo LiveKit Inbound";

const SIP_HOST_ENV_KEYS = [
  "LIVEKIT_SIP_HOST",
  "LIVEKIT_SIP_URI",
  "LIVEKIT_SIP_ENDPOINT",
  "LIVEKIT_SIP_FQDN",
  "SIP_HOST",
] as const;

export function normalizeLiveKitSipHost(raw: string): string {
  let value = raw.trim();
  if (!value) return "";
  if (value.startsWith("sip:")) value = value.slice(4);
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      // keep value
    }
  }
  value = value.replace(/\/+$/, "").split("/")[0] || value;
  return value.replace(/^sip:/i, "");
}

export function resolveLiveKitSipHost(): { host: string; source: string | null } {
  for (const key of SIP_HOST_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const host = normalizeLiveKitSipHost(raw);
    if (host) return { host, source: key };
  }
  const livekitUrl = process.env.LIVEKIT_URL?.trim();
  if (livekitUrl) {
    const direct = normalizeLiveKitSipHost(livekitUrl);
    if (direct.includes(".sip.livekit.cloud")) {
      return { host: direct, source: "LIVEKIT_URL(sip)" };
    }
    try {
      const withProto = livekitUrl.includes("://") ? livekitUrl : `wss://${livekitUrl}`;
      const host = new URL(withProto).hostname;
      if (host.endsWith(".livekit.cloud") && !host.includes(".sip.")) {
        return {
          host: host.replace(/\.livekit\.cloud$/, ".sip.livekit.cloud"),
          source: "LIVEKIT_URL(derived)",
        };
      }
      if (host.includes(".sip.livekit.cloud")) {
        return { host, source: "LIVEKIT_URL(sip)" };
      }
    } catch {
      // ignore
    }
  }
  return { host: "", source: null };
}

export function getStoredLiveKitTrunkId(): string | null {
  return process.env.LIVEKIT_INBOUND_TRUNK_ID?.trim() || null;
}

export function getStoredTelnyxFqdnConnectionId(): string | null {
  return process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID?.trim() || null;
}

export function requireLiveKitApiEnv() {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)");
  }
  return { url, apiKey, apiSecret };
}

export function getPhoneCallControlConnectionId(): string | null {
  return (
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim() ||
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    null
  );
}

export function getMctbTexmlAppId(): string | null {
  return process.env.MCTB_TEXML_APP_ID?.trim() || null;
}
