#!/usr/bin/env tsx
/**
 * Pure unit tests for effective transfer state (no browser/PSTN).
 * Run: npx tsx scripts/test-voice-effective-transfer-state.ts
 */
import assert from "node:assert/strict";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  deriveEffectiveTransferState,
  withTransferCallsCapability,
} from "../src/lib/voice/call-handling/effective-transfer-state";

const base = createDefaultWizardState();
base.capabilities = ["transfer_calls"];
base.voiceV2HumanTransferEnabled = true;
base.transferDestinations = [
  { id: "d1", label: "Office", phoneE164: "+14155550100", enabled: true },
];
base.transferPlanSteps = [
  { destinationId: "d1", order: 1, transferMode: "BASIC", timeoutSeconds: 20 },
];

const ready = deriveEffectiveTransferState(base);
assert.equal(ready.canAmyTransferNow, true);
assert.equal(ready.blockers.length, 0);

const noCap = deriveEffectiveTransferState(
  withTransferCallsCapability(base, false),
);
assert.equal(noCap.canAmyTransferNow, false);
assert.ok(noCap.blockers.some((b) => b.includes("Transfer calls")));

const switchOff = deriveEffectiveTransferState({
  ...base,
  voiceV2HumanTransferEnabled: false,
});
assert.equal(switchOff.canAmyTransferNow, false);

console.log("test-voice-effective-transfer-state: OK");
