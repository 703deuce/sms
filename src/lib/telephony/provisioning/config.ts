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

/** LiveKit SIP ingress host, e.g. vjnxecm0tjk.sip.livekit.cloud */
export function getLiveKitSipHost(): string {
  const raw = process.env.LIVEKIT_SIP_HOST?.trim();
  if (raw) return raw.replace(/^sip:/i, "");
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    if (host.endsWith(".livekit.cloud")) {
      return host.replace(/\.livekit\.cloud$/, ".sip.livekit.cloud");
    }
  } catch {
    // ignore
  }
  return "";
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

export function assertLiveKitProvisioningEnv() {
  const { url, apiKey, apiSecret } = requireLiveKitEnv();
  const sipHost = getLiveKitSipHost();
  if (!sipHost) {
    throw new Error(
      "LIVEKIT_SIP_HOST is required for Telnyx→LiveKit provisioning (or set LIVEKIT_URL to a *.livekit.cloud host)",
    );
  }
  return { url, apiKey, apiSecret, sipHost };
}
