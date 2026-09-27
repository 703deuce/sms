#!/usr/bin/env npx tsx
/**
 * Voice V3 transfer launch certification labels (contract-level, no PSTN).
 */
import assert from "node:assert/strict";
import { compileVoiceV3TransferPolicyFromWizard } from "../src/lib/voice-v3/transfer/compile-transfer-config";
import { authorizeVoiceV3Transfer } from "../src/lib/voice-v3/transfer/authorize-transfer";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import type { VoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";

function ctx(): VoiceV3CallContext {
  return {
    callId: "call_cert",
    liveSessionId: "lk_cert",
    intake: { values: { name: { value: "Caller" } } },
    telephony: { inboundCallerE164: "+15551230000" },
  } as VoiceV3CallContext;
}

function wizardCold(): AppointmentReceptionistWizardState {
  return {
    capabilities: ["transfer_calls"],
    transferDestinations: [
      { id: "oncall", label: "On call", phoneE164: "+15559870001", enabled: true },
    ],
    transferRouting: "single",
    transferPlanSteps: [
      { order: 1, destinationId: "oncall", transferMode: "BASIC", timeoutSeconds: 25 },
    ],
    transferRingSeconds: 25,
    transferFallback: "return_to_ai",
    voiceV2HumanTransferEnabled: true,
    agentName: "Amy",
    businessName: "Cert Co",
  } as AppointmentReceptionistWizardState;
}

function wizardWarm(): AppointmentReceptionistWizardState {
  return {
    ...wizardCold(),
    transferPlanSteps: [
      { order: 1, destinationId: "oncall", transferMode: "WARM", timeoutSeconds: 30 },
    ],
    warmTransfer: true,
  } as AppointmentReceptionistWizardState;
}

function wizardWaterfall(): AppointmentReceptionistWizardState {
  return {
    ...wizardCold(),
    transferDestinations: [
      { id: "a", label: "A", phoneE164: "+15559870001", enabled: true },
      { id: "b", label: "B", phoneE164: "+15559870002", enabled: true },
    ],
    transferRouting: "waterfall",
    transferPlanSteps: [
      { order: 1, destinationId: "a", transferMode: "BASIC", timeoutSeconds: 15 },
      { order: 2, destinationId: "b", transferMode: "BASIC", timeoutSeconds: 20 },
    ],
  } as AppointmentReceptionistWizardState;
}

// COLD: DIRECT mode in authorized plan → LiveKit SIP REFER in transfer_executor._direct_transfer
const coldPolicy = compileVoiceV3TransferPolicyFromWizard(wizardCold());
const coldConfig = compileVoiceV3AgentConfig({ wizard: wizardCold() });
const coldAuth = authorizeVoiceV3Transfer({
  config: coldConfig,
  policy: coldPolicy,
  callContext: ctx(),
  args: {},
});
assert.equal(coldAuth.ok, true);
if (!coldAuth.ok) throw new Error("cold auth failed");
assert.equal(coldAuth.data.execution.targets[0]?.mode, "DIRECT");
console.log("COLD_TRANSFER_CERTIFIED=PASS (authorize DIRECT + compile + transfer_call contract)");

// WARM: WARM mode + handoff + outbound trunk fields on plan → WarmTransferTask in transfer_executor
const warmPolicy = compileVoiceV3TransferPolicyFromWizard(wizardWarm());
assert.equal(warmPolicy.routes[0]?.targets[0]?.mode, "WARM");
const warmConfig = compileVoiceV3AgentConfig({ wizard: wizardWarm() });
const warmAuth = authorizeVoiceV3Transfer({
  config: warmConfig,
  policy: warmPolicy,
  callContext: ctx(),
  args: {},
});
assert.equal(warmAuth.ok, true);
if (!warmAuth.ok) throw new Error("warm auth failed");
assert.equal(warmAuth.data.execution.targets[0]?.mode, "WARM");
assert.ok(warmAuth.data.execution.handoff_instructions.length > 10);
console.log(
  "WARM_TRANSFER_CERTIFIED=PASS (authorize WARM + handoff; PSTN requires outbound SIP trunk at publish)",
);

// Waterfall: multiple targets in one authorized plan
const wfPolicy = compileVoiceV3TransferPolicyFromWizard(wizardWaterfall());
assert.equal(wfPolicy.routing, "waterfall");
assert.equal(wfPolicy.routes[0]?.targets.length, 2);
const wfConfig = compileVoiceV3AgentConfig({ wizard: wizardWaterfall() });
const wfAuth = authorizeVoiceV3Transfer({
  config: wfConfig,
  policy: wfPolicy,
  callContext: ctx(),
  args: {},
});
assert.equal(wfAuth.ok, true);
if (!wfAuth.ok) throw new Error("waterfall auth failed");
assert.equal(wfAuth.data.execution.targets.length, 2);
console.log("WATERFALL_TRANSFER_CERTIFIED=PASS (multi-target authorize; executor loops attempts)");

console.log("VOICE_V3_TRANSFER_COLD_WARM_CERT=PASS");
