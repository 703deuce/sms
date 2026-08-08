import { requireLiveKitEnv } from "@/lib/voice/runtime-provider/config";

export const TRANSOVO_LIVEKIT_AGENT_NAME =
  process.env.LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-runtime";

export const TRANSOVO_LIVEKIT_TRUNK_NAME =
  process.env.LIVEKIT_INBOUND_TRUNK_NAME?.trim() || "transovo-telnyx-inbound";

export const TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME =
  process.env.LIVEKIT_DISPATCH_RULE_NAME?.trim() || "transovo-inbound-dispatch";

export const TRANSOVO_LIVEKIT_ROOM_PREFIX =
  process.env.LIVEKIT_INBOUND_ROOM_PREFIX?.trim() || "transovo-call-";

export const TRANSOVO_TELNYX_FQDN_CONNECTION_NAME =
  process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_NAME?.trim() ||
  "Transovo LiveKit Inbound";

/** Normalize any LiveKit SIP host / URI env value to bare hostname. */
export function normalizeLiveKitSipHost(raw: string): string {
  let value = raw.trim();
  if (!value) return "";

  if (value.startsWith("sip:")) {
    value = value.slice(4);
  }
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      // fall through with original
    }
  }
  value = value.replace(/\/+$/, "").split("/")[0] || value;
  return value.replace(/^sip:/i, "");
}

const SIP_HOST_ENV_KEYS = [
  "LIVEKIT_SIP_HOST",
  "LIVEKIT_SIP_URI",
  "LIVEKIT_SIP_ENDPOINT",
  "LIVEKIT_SIP_FQDN",
  "SIP_HOST",
] as const;

export type LiveKitSipHostResolution = {
  host: string;
  source: string | null;
};

/**
 * Resolve LiveKit SIP ingress host from env.
 * Coolify setups often store the `*.sip.livekit.cloud` value on LIVEKIT_URL
 * (or LIVEKIT_SIP_URI) rather than a separate LIVEKIT_SIP_HOST key.
 */
export function resolveLiveKitSipHost(): LiveKitSipHostResolution {
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

/** LiveKit SIP ingress host, e.g. sms-xxxxx.sip.livekit.cloud */
export function getLiveKitSipHost(): string {
  return resolveLiveKitSipHost().host;
}

export function getLiveKitSipHostSource(): string | null {
  return resolveLiveKitSipHost().source;
}

export function getStoredLiveKitTrunkId(): string | null {
  return process.env.LIVEKIT_INBOUND_TRUNK_ID?.trim() || null;
}

export function getStoredLiveKitDispatchRuleId(): string | null {
  return process.env.LIVEKIT_DISPATCH_RULE_ID?.trim() || null;
}

export function getStoredTelnyxFqdnConnectionId(): string | null {
  return process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID?.trim() || null;
}

export function getLiveKitProjectAlignment(): {
  apiHostname: string;
  sipHost: string;
  sipHostSource: string | null;
  derivedSipFromApi: string;
  sipMatchesDerivedFromApi: boolean;
  usingExplicitSipEnv: boolean;
} {
  const { url } = requireLiveKitEnv();
  const apiHostname = new URL(url).hostname;
  const sip = resolveLiveKitSipHost();
  const derivedSipFromApi = apiHostname.replace(/\.livekit\.cloud$/i, ".sip.livekit.cloud");
  const explicitKeys = [
    "LIVEKIT_SIP_HOST",
    "LIVEKIT_SIP_URI",
    "LIVEKIT_SIP_ENDPOINT",
    "LIVEKIT_SIP_FQDN",
    "SIP_HOST",
  ] as const;
  const usingExplicitSipEnv = explicitKeys.some((k) => Boolean(process.env[k]?.trim()));
  return {
    apiHostname,
    sipHost: sip.host,
    sipHostSource: sip.source,
    derivedSipFromApi,
    sipMatchesDerivedFromApi: sip.host === derivedSipFromApi,
    usingExplicitSipEnv,
  };
}

export function assertLiveKitProvisioningEnv() {
  const { url, apiKey, apiSecret } = requireLiveKitEnv();
  const sipHost = getLiveKitSipHost();
  if (!sipHost) {
    throw new Error(
      "LiveKit SIP host not found. Set LIVEKIT_SIP_HOST, LIVEKIT_SIP_URI, or LIVEKIT_URL to your *.sip.livekit.cloud endpoint",
    );
  }
  return { url, apiKey, apiSecret, sipHost };
}
