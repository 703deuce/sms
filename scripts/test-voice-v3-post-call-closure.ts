/**
 * Focused deterministic checks for final pre-merge closure (webhooks, knowledge gaps, SCREEN).
 */
import assert from "node:assert/strict";
import { deriveVoiceV3PostCallOutcome } from "../src/lib/voice-v3/post-call/derive-call-outcome";
import { buildAmySpamSolicitorInstructions } from "../src/lib/voice-v3/spam-protection/prompt-sections";
import { normalizeTelnyxScreeningValue } from "../src/lib/voice-v3/spam-protection/types";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { ensureWizardOperatingMaturity } from "../src/lib/solutions/appointment-receptionist/operating-maturity-wizard";

function testOutcomeDerivation() {
  const facts = { callbackRequested: true, appointmentBooked: false };
  assert.equal(deriveVoiceV3PostCallOutcome(facts, null), "CALLBACK_REQUESTED");
}

function testScreenPromptHint() {
  const spam = { spamLikelyPolicy: "SCREEN" as const, solicitorPolicy: "ALLOW" as const };
  const withFlag = buildAmySpamSolicitorInstructions(spam, { suspectedSpamLikely: true });
  assert.match(withFlag, /possible spam/i);
  const without = buildAmySpamSolicitorInstructions(spam, { suspectedSpamLikely: false });
  assert.doesNotMatch(without, /possible spam/i);
}

function testTelnyxScreeningNormalize() {
  assert.equal(normalizeTelnyxScreeningValue("spam_likely"), "spam_likely");
  assert.equal(normalizeTelnyxScreeningValue("SPAM"), "spam_likely");
}

function testOperatingPolicyCompiled() {
  const state = createDefaultWizardState();
  const maturity = ensureWizardOperatingMaturity(state);
  maturity.callbackSla = { ...maturity.callbackSla, normalTarget: "1h" };
  const config = compileVoiceV3AgentConfig({ wizard: state });
  assert.equal(config.operatingPolicy?.callbackSla.normalTarget, "1h");
}

testOutcomeDerivation();
testScreenPromptHint();
testTelnyxScreeningNormalize();
testOperatingPolicyCompiled();

console.log("test-voice-v3-post-call-closure: PASS");
