import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";

const BLOCKED_MODES = new Set(["livekit_sip", "mctb_texml"]);

/** Whether per-number answering policy (forward / IVR) may run on Telnyx Call Control. */
export function phoneCallForwardingRuntimeAllowed(settingsJson: unknown): boolean {
  const telephony = readTelephonyProvision(settingsJson);
  const mode = telephony.routingMode;
  if (mode && BLOCKED_MODES.has(mode) && telephony.state === "active") {
    return false;
  }
  if (telephony.state === "error" || telephony.state === "removed") {
    return false;
  }
  return true;
}
