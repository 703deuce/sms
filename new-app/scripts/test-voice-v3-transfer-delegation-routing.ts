/**
 * transfer_call: LiveKit SIP plans defer to worker; Call Control plans execute on Node.
 */
import assert from "node:assert/strict";
import { planRequiresNodeTelnyxCallControlHandoff } from "../lib/server/voice-v3/transfer/delegation-routing";
import type { VoiceV3AuthorizedTransferPlan } from "../lib/server/voice-v3/transfer/types";

const livekitPlan: VoiceV3AuthorizedTransferPlan = {
  transfer_request_id: "tr_test",
  route_id: "cr_billing",
  fallback: "TAKE_MESSAGE",
  handoff_instructions: "test",
  outbound_sip_trunk_id: null,
  outbound_caller_id_e164: null,
  targets: [
    {
      destination_id: "dest_billing",
      mode: "DIRECT",
      dial_target: "+17038166017",
      ringing_timeout_seconds: 30,
      executor: "livekit_sip",
    },
  ],
};

assert.equal(planRequiresNodeTelnyxCallControlHandoff(livekitPlan), false);

const ccPlan: VoiceV3AuthorizedTransferPlan = {
  ...livekitPlan,
  targets: [{ ...livekitPlan.targets[0], executor: "phone_call_control" }],
};

assert.equal(planRequiresNodeTelnyxCallControlHandoff(ccPlan), true);

console.log("PASS voice-v3 transfer delegation routing");
