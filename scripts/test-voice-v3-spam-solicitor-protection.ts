/**
 * Voice V3 spam & solicitor protection — mapping + wizard round-trip.
 * Run: npx tsx scripts/test-voice-v3-spam-solicitor-protection.ts
 */
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  telnyxInboundScreeningForPolicy,
  normalizeTelnyxScreeningValue,
  wizardSpamProtectionFromState,
} from "../src/lib/voice-v3/spam-protection/types";

function testTelnyxMapping() {
  assert.equal(telnyxInboundScreeningForPolicy("BLOCK"), "reject_calls");
  assert.equal(telnyxInboundScreeningForPolicy("SCREEN"), "flag_calls");
  assert.equal(telnyxInboundScreeningForPolicy("ALLOW"), "flag_calls");
  assert.equal(telnyxInboundScreeningForPolicy(null), null);
}

function testNormalizeScreening() {
  assert.equal(normalizeTelnyxScreeningValue("SPAM LIKELY"), "spam_likely");
  assert.equal(normalizeTelnyxScreeningValue("spam_likely"), "spam_likely");
  assert.equal(normalizeTelnyxScreeningValue(""), "unknown");
}

function testWizardRoundTrip() {
  const w = createDefaultWizardState();
  assert.equal(w.spamLikelyPolicy, "BLOCK");
  assert.equal(w.solicitorPolicy, "DECLINE");
  const compiled = compileVoiceV3AgentConfig({ wizard: w, source: "wizard_published" });
  assert.equal(compiled.spamProtection.spamLikelyPolicy, "BLOCK");
  assert.equal(compiled.spamProtection.solicitorPolicy, "DECLINE");
}

function testLegacyCompat() {
  const legacy = wizardSpamProtectionFromState({
    salesSolicitationEnabled: true,
    salesSolicitationAction: "DECLINE_POLITELY",
  });
  assert.equal(legacy.solicitorPolicy, "DECLINE");
  assert.equal(legacy.spamLikelyPolicy, null);
}

function main() {
  testTelnyxMapping();
  testNormalizeScreening();
  testWizardRoundTrip();
  testLegacyCompat();
  console.log("PASS voice-v3-spam-solicitor-protection");
}

main();
