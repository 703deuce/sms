import type { RoutePolicyDto } from "@/lib/phone/types";
import { normalizeE164 } from "@/lib/server/phone/normalize";

/** External forward destination from saved routing policy or env fallback. */
export function resolveExternalForwardTarget(routing: RoutePolicyDto & { externalForwardE164?: string | null }): string | null {
  const fromPolicy =
    typeof routing.externalForwardE164 === "string" && routing.externalForwardE164.trim()
      ? normalizeE164(routing.externalForwardE164)
      : null;
  if (fromPolicy) return fromPolicy;
  const env = process.env.PHONE_INBOUND_EXTERNAL_FORWARD?.trim();
  return env ? normalizeE164(env) : null;
}
