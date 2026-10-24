import type { VoiceV3AuthorizedTransferPlan } from "./types";

/** True when every target must run on Node via Telnyx Call Control (not LiveKit SIP REFER). */
export function planRequiresNodeTelnyxCallControlHandoff(
  plan: VoiceV3AuthorizedTransferPlan,
): boolean {
  return (
    plan.targets.length > 0 &&
    plan.targets.every(
      (t) => (t.executor || "livekit_sip").toLowerCase() === "phone_call_control",
    )
  );
}
