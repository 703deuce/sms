#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { authorizeVoiceV3Transfer } from "../src/lib/voice-v3/transfer/authorize-transfer";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";

const config = {
  workspaceId: "ws",
  businessName: "Biz",
  identity: { agentName: "Amy" },
  callHandling: {
    allowCallerRequestedTransfer: true,
    detectVoicemailOnTransfer: true,
    callbackRequestsEnabled: false,
  },
  transferPolicy: {
    enabled: true,
    defaultRingingTimeoutSeconds: 25,
    defaultFallback: "RETURN_TO_AGENT",
    routing: "single",
    destinations: [
      {
        id: "front",
        label: "Front desk",
        phoneE164: "+15559876543",
        defaultMode: "DIRECT",
        ringingTimeoutSeconds: 25,
        enabled: true,
      },
    ],
    routes: [
      {
        id: "default",
        label: "Default",
        description: "",
        targets: [{ destinationId: "front", mode: "DIRECT", ringingTimeoutSeconds: 25 }],
        fallback: "RETURN_TO_AGENT",
      },
    ],
    telephony: { outboundSipTrunkId: "trunk", outboundCallerIdE164: "+15551110000" },
  },
} as VoiceV3AgentConfig;

const policy = config.transferPolicy;
const ctx = createInitialVoiceV3CallContext({ callId: "c1", liveSessionId: "lk1" });
const auth = authorizeVoiceV3Transfer({ config, policy, callContext: ctx, args: {} });
assert.equal(auth.ok, true);
if (auth.ok) {
  const plan = auth.data.execution;
  assert.equal(plan.detect_voicemail_on_transfer, true);
}

const off = { ...config, callHandling: { ...config.callHandling, detectVoicemailOnTransfer: false } };
const authOff = authorizeVoiceV3Transfer({
  config: off,
  policy,
  callContext: ctx,
  args: {},
});
assert.equal(authOff.ok, true);
if (authOff.ok) {
  assert.equal(authOff.data.execution.detect_voicemail_on_transfer, false);
}

console.log("VOICE_V3_TRANSFER_AMD_CONTRACT=PASS");
