import type { LiveKitSipHostResolution } from "@/lib/telephony/provisioning/config";
import { resolveLiveKitSipHost } from "@/lib/telephony/provisioning/config";

/** SIP host Telnyx should route to — always LiveKit Cloud project ingress. */
export function resolveAuthoritativeLiveKitSipHost(): LiveKitSipHostResolution {
  return resolveLiveKitSipHost();
}
