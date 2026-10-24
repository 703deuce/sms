/**
 * Ensures LiveKit inbound legs route transfer_call to livekit_sip, not phone_call_control-only.
 */
import assert from "node:assert/strict";
import { authorizeVoiceV3Transfer } from "../lib/server/voice-v3/transfer/authorize-transfer";
import type { VoiceV3TransferPolicyCompiled } from "../lib/server/voice-v3/transfer/types";
import type { VoiceV3AgentConfig } from "../lib/server/voice-v3/config/agent-config";

const policy: VoiceV3TransferPolicyCompiled = {
  enabled: true,
  routing: "single",
  defaultRingingTimeoutSeconds: 30,
  defaultFallback: "voicemail",
  destinations: [
    {
      id: "dest_billing",
      label: "Billing",
      phoneE164: "+15551234567",
      defaultMode: "DIRECT",
      ringingTimeoutSeconds: 30,
      enabled: true,
    },
  ],
  routes: [
    {
      id: "route_default",
      label: "Default",
      description: "",
      targets: [{ destinationId: "dest_billing", mode: "DIRECT", ringingTimeoutSeconds: 30 }],
      fallback: "voicemail",
    },
  ],
  telephony: { outboundSipTrunkId: null, outboundCallerIdE164: null },
};

const config = {
  workspaceId: "ws_test",
  businessName: "Test",
  identity: { agentName: "Amy" },
  callHandling: { allowCallerRequestedTransfer: true, callbackRequestsEnabled: false },
} as VoiceV3AgentConfig;

const liveKitCtx = {
  callId: "vc_test",
  liveSessionId: "ls_test",
  telephony: {
    inboundCallerE164: "+15559876543",
    liveKit: { roomName: "room-1", sipParticipantIdentity: "sip_abc" },
  },
};

const res = authorizeVoiceV3Transfer({
  config,
  policy,
  callContext: liveKitCtx as import("../lib/server/voice-v3/state/call-context").VoiceV3CallContext,
  args: { route_id: "route_default", reason: "caller asked for billing" },
});

assert.equal(res.ok, true);
if (res.ok && res.data?.execution) {
  assert.equal(res.data.execution.targets[0]?.executor, "livekit_sip");
  assert.equal(res.data.execution.targets[0]?.dial_target, "+15551234567");
  console.log("PASS voice-v3 transfer routes LiveKit SIP when participant present");
} else {
  throw new Error("expected authorized transfer");
}
