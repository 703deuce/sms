import type { LiveKitSipHostResolution } from "@/lib/telephony/provisioning/config";
import { resolveLiveKitSipHost } from "@/lib/telephony/provisioning/config";
import { getLiveKitBackendConfig } from "./config";
import { getActiveMediaBackend } from "./resolver";

function readEnv(name: string): string {
  return (process.env[name]?.trim() || "").replace(/^["']|["']$/g, "");
}

/**
 * SIP host Telnyx should route to for the active media backend.
 * When self_hosted, ignores Cloud LIVEKIT_SIP_URI so PSTN ingress follows the switch.
 */
export function resolveAuthoritativeLiveKitSipHost(): LiveKitSipHostResolution {
  const backend = getActiveMediaBackend();
  if (backend !== "self_hosted") {
    return resolveLiveKitSipHost();
  }

  const cfg = getLiveKitBackendConfig("self_hosted");
  if (readEnv("LIVEKIT_SELF_HOSTED_SIP_HOST")) {
    return { host: cfg.sipHost, source: "LIVEKIT_SELF_HOSTED_SIP_HOST" };
  }
  if (readEnv("LIVEKIT_SELF_HOSTED_SIP_URI")) {
    return { host: cfg.sipHost, source: "LIVEKIT_SELF_HOSTED_SIP_URI" };
  }
  return { host: cfg.sipHost, source: "MEDIA_BACKEND_MODE(self_hosted)" };
}
