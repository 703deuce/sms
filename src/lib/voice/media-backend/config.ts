import { normalizeLiveKitSipHost } from "@/lib/telephony/provisioning/config";
import { normalizeLiveKitApiUrl } from "@/lib/voice/runtime-provider/config";
import type { LiveKitBackendConfig, MediaBackend, MediaBackendMode } from "./types";

const BACKEND_ENV_PREFIX: Record<MediaBackend, string> = {
  livekit_cloud: "LIVEKIT_CLOUD",
  self_hosted: "LIVEKIT_SELF_HOSTED",
};

function readEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

function readBackendEnv(backend: MediaBackend, suffix: string): string {
  const prefixed = readEnv(`${BACKEND_ENV_PREFIX[backend]}_${suffix}`);
  if (prefixed) return prefixed;

  if (backend === "livekit_cloud") {
    const legacyMap: Record<string, string> = {
      URL: "LIVEKIT_URL",
      API_KEY: "LIVEKIT_API_KEY",
      API_SECRET: "LIVEKIT_API_SECRET",
      SIP_HOST: "LIVEKIT_SIP_HOST",
      SIP_URI: "LIVEKIT_SIP_URI",
      INBOUND_TRUNK_ID: "LIVEKIT_INBOUND_TRUNK_ID",
      OUTBOUND_TRUNK_ID: "LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID",
      DISPATCH_RULE_ID: "LIVEKIT_DISPATCH_RULE_ID",
    };
    const legacy = legacyMap[suffix];
    if (legacy) return readEnv(legacy);
    if (suffix === "OUTBOUND_TRUNK_ID") {
      return (
        readEnv("LIVEKIT_OUTBOUND_TRUNK_ID") ||
        readEnv("LIVEKIT_SIP_OUTBOUND_TRUNK") ||
        ""
      );
    }
  }

  if (backend === "self_hosted" && suffix === "URL" && !prefixed) {
    return readEnv("LIVEKIT_SELF_HOSTED_URL") || "wss://voice.transovo.ai";
  }

  return "";
}

function resolveSipHost(backend: MediaBackend, rawUrl: string): string {
  const explicit =
    readBackendEnv(backend, "SIP_HOST") ||
    readBackendEnv(backend, "SIP_URI") ||
    readBackendEnv(backend, "SIP_ENDPOINT") ||
    readBackendEnv(backend, "SIP_FQDN");
  if (explicit) return normalizeLiveKitSipHost(explicit);

  if (backend === "self_hosted") {
    return "voice.transovo.ai";
  }

  if (rawUrl) {
    const normalized = normalizeLiveKitSipHost(rawUrl);
    if (normalized.includes(".sip.livekit.cloud")) return normalized;
    try {
      const host = new URL(
        rawUrl.includes("://") ? rawUrl : `wss://${rawUrl}`,
      ).hostname;
      if (host.endsWith(".livekit.cloud") && !host.includes(".sip.")) {
        return host.replace(/\.livekit\.cloud$/i, ".sip.livekit.cloud");
      }
    } catch {
      // ignore
    }
  }
  return "";
}

export function getMediaBackendMode(): MediaBackendMode {
  const raw = readEnv("MEDIA_BACKEND_MODE").toLowerCase();
  if (raw === "self_hosted" || raw === "livekit_cloud" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export function isMediaBackendConfigured(backend: MediaBackend): boolean {
  try {
    getLiveKitBackendConfig(backend);
    return true;
  } catch {
    return false;
  }
}

export function getLiveKitBackendConfig(backend: MediaBackend): LiveKitBackendConfig {
  const rawUrl = readBackendEnv(backend, "URL");
  const apiKey = readBackendEnv(backend, "API_KEY");
  const apiSecret = readBackendEnv(backend, "API_SECRET");

  if (!rawUrl || !apiKey || !apiSecret) {
    throw new Error(
      `${BACKEND_ENV_PREFIX[backend]}_URL, _API_KEY, and _API_SECRET are required for ${backend}`,
    );
  }

  const url = normalizeLiveKitApiUrl(rawUrl);
  const sipHost = resolveSipHost(backend, rawUrl);
  if (!sipHost) {
    throw new Error(`SIP host not configured for media backend ${backend}`);
  }

  const defaultNames =
    backend === "self_hosted"
      ? {
          inboundTrunkName: "transovo-telnyx-inbound-selfhosted",
          outboundTrunkName: "transovo-telnyx-outbound-selfhosted",
          dispatchRuleName: "transovo-inbound-dispatch-selfhosted",
        }
      : {
          inboundTrunkName:
            readEnv("LIVEKIT_INBOUND_TRUNK_NAME") || "transovo-telnyx-inbound",
          outboundTrunkName:
            readEnv("LIVEKIT_OUTBOUND_TRUNK_NAME") || "transovo-telnyx-outbound",
          dispatchRuleName:
            readEnv("LIVEKIT_DISPATCH_RULE_NAME") || "transovo-inbound-dispatch",
        };

  return {
    backend,
    url,
    apiKey,
    apiSecret,
    sipHost,
    inboundTrunkId: readBackendEnv(backend, "INBOUND_TRUNK_ID") || null,
    outboundTrunkId: readBackendEnv(backend, "OUTBOUND_TRUNK_ID") || null,
    dispatchRuleId: readBackendEnv(backend, "DISPATCH_RULE_ID") || null,
    ...defaultNames,
  };
}

export function getAuthoritativeLiveKitSipHostForBackend(
  backend: MediaBackend,
): { host: string; source: string } {
  const cfg = getLiveKitBackendConfig(backend);
  return { host: cfg.sipHost, source: `${BACKEND_ENV_PREFIX[backend]}_SIP` };
}

export function getTelnyxFqdnConnectionNameForBackend(backend: MediaBackend): string {
  if (backend === "self_hosted") {
    return (
      readEnv("TELNYX_SELF_HOSTED_FQDN_CONNECTION_NAME") ||
      "Transovo Self-Hosted LiveKit TEST"
    );
  }
  return (
    readEnv("TELNYX_LIVEKIT_FQDN_CONNECTION_NAME") || "Transovo LiveKit Inbound"
  );
}

export function getTelnyxStoredFqdnConnectionIdForBackend(
  backend: MediaBackend,
): string | null {
  if (backend === "self_hosted") {
    return readEnv("TELNYX_SELF_HOSTED_FQDN_CONNECTION_ID") || null;
  }
  return readEnv("TELNYX_LIVEKIT_FQDN_CONNECTION_ID") || null;
}

export function isTelnyxLiveKitFailoverEnabled(): boolean {
  const raw = readEnv("TELNYX_LIVEKIT_FAILOVER_ENABLED").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Designated test DID for self-hosted-only Telnyx routing. */
export function getSelfHostedTestDid(): string | null {
  return readEnv("LIVEKIT_SELF_HOSTED_TEST_DID") || "+18663221763";
}
