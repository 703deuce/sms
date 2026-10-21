import "server-only";

import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";
import { routeNumberToPhoneCallControl } from "@/lib/server/telephony/product-routes";
import { phoneCallForwardingRuntimeAllowed } from "@/lib/server/telephony/forwarding-runtime-gate";

const BLOCKED_MODES = new Set(["livekit_sip", "mctb_texml"]);

/**
 * Phone call forwarding requires the DID on Telnyx Call Control with provision state active.
 * Legacy numbers may have no telephony block — route them when forwarding is configured.
 */
export async function ensurePhoneCallControlForForwarding(input: {
  workspaceId: string;
  phoneNumberId: string;
  settingsJson: unknown;
}): Promise<{ ok: boolean; error?: string }> {
  const telephony = readTelephonyProvision(input.settingsJson);
  const mode = telephony.routingMode;

  if (mode && BLOCKED_MODES.has(mode) && telephony.state === "active") {
    return {
      ok: false,
      error: `This number is on ${mode} ingress; switch it to Phone in Numbers before using call forwarding.`,
    };
  }

  if (telephony.routingMode === "telnyx_call_control" && telephony.state === "active") {
    return { ok: true };
  }

  const routed = await routeNumberToPhoneCallControl({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });
  if (!routed.ok) {
    return { ok: false, error: routed.error || "Could not route number to Phone call control" };
  }
  return { ok: true };
}

export { phoneCallForwardingRuntimeAllowed };
