import { normalizeLiveKitSipHost } from "@/lib/telephony/provisioning/config";
import { normalizeLiveKitApiUrl } from "@/lib/voice/runtime-provider/config";
import {
  DEFAULT_MEDIA_BACKEND_MODE,
  LIVEKIT_CLOUD_DISPATCH_RULE_ID,
  LIVEKIT_CLOUD_INBOUND_TRUNK_ID,
  LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID,
  LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID,
  LIVEKIT_SELF_HOSTED_SIP_HOST,
  LIVEKIT_SELF_HOSTED_WSS_URL,
} from "./constants";
import type { LiveKitBackendConfig, MediaBackend, MediaBackendMode } from "./types";

function readEnv(name: string): string {
  return (process.env[name]?.trim() || "").replace(/^["']|["']$/g, "");
}

function readCloudEnv(suffix: string): string {
  const cloudPrefixed = readEnv(`LIVEKIT_CLOUD_${suffix}`);
  if (cloudPrefixed) return cloudPrefixed;

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
  if (legacy) {
    const value = readEnv(legacy);
    if (value) return value;
  }
  if (suffix === "OUTBOUND_TRUNK_ID") {
    return readEnv("LIVEKIT_OUTBOUND_TRUNK_ID") || readEnv("LIVEKIT_SIP_OUTBOUND_TRUNK") || "";
  }
  return "";
}

function readSelfHostedEnv(suffix: string): string {
  return readEnv(`LIVEKIT_SELF_HOSTED_${suffix}`);
}

function readBackendEnv(backend: MediaBackend, suffix: string): string {
  return backend === "self_hosted" ? readSelfHostedEnv(suffix) : readCloudEnv(suffix);
}

function resolveSipHost(backend: MediaBackend, rawUrl: string): string {
  if (backend === "self_hosted") {
    const explicit =
      readSelfHostedEnv("SIP_HOST") ||
      readSelfHostedEnv("SIP_URI");
    if (explicit) return normalizeLiveKitSipHost(explicit);
    return LIVEKIT_SELF_HOSTED_SIP_HOST;
  }

  const explicit = readCloudEnv("SIP_HOST") || readCloudEnv("SIP_URI");
  if (explicit) return normalizeLiveKitSipHost(explicit);

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
      if (!host.endsWith(".livekit.cloud")) {
        return host;
      }
    } catch {
      // ignore
    }
  }
  return "";
}

/**
 * LiveKit Cloud is the only active media plane. Self-hosted (voice.transovo.ai) is retired.
 * Stale Coolify `MEDIA_BACKEND_MODE=self_hosted` must not route SIP provisioning to that host (502).
 */
export function getMediaBackendMode(): MediaBackendMode {
  const raw = readEnv("MEDIA_BACKEND_MODE").toLowerCase();
  if (raw === "self_hosted") {
    console.warn(
      JSON.stringify({
        service: "transovo-web",
        event: "media_backend_self_hosted_ignored",
        message:
          "MEDIA_BACKEND_MODE=self_hosted is ignored; all voice uses livekit_cloud",
      }),
    );
  }
  return "livekit_cloud";
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
  const rawUrl =
    backend === "self_hosted"
      ? readSelfHostedEnv("URL") || LIVEKIT_SELF_HOSTED_WSS_URL
      : readCloudEnv("URL");
  const apiKey = readBackendEnv(backend, "API_KEY");
  const apiSecret = readBackendEnv(backend, "API_SECRET");

  if (!apiKey || !apiSecret) {
    const prefix = backend === "self_hosted" ? "LIVEKIT_SELF_HOSTED" : "LIVEKIT";
    throw new Error(`${prefix}_API_KEY and _API_SECRET are required for ${backend}`);
  }

  if (!rawUrl) {
    throw new Error(
      backend === "self_hosted"
        ? "Self-hosted LiveKit URL missing (unexpected — check constants)"
        : "LIVEKIT_URL (or LIVEKIT_CLOUD_URL) is required for livekit_cloud",
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

  const frozenTrunkId =
    backend === "self_hosted" ? LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID : LIVEKIT_CLOUD_INBOUND_TRUNK_ID;
  const frozenDispatchId =
    backend === "self_hosted"
      ? LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID
      : LIVEKIT_CLOUD_DISPATCH_RULE_ID;

  return {
    backend,
    url,
    apiKey,
    apiSecret,
    sipHost,
    inboundTrunkId: readBackendEnv(backend, "INBOUND_TRUNK_ID") || frozenTrunkId,
    outboundTrunkId: readBackendEnv(backend, "OUTBOUND_TRUNK_ID") || null,
    dispatchRuleId: readBackendEnv(backend, "DISPATCH_RULE_ID") || frozenDispatchId,
    ...defaultNames,
  };
}
