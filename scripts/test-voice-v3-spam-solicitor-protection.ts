/**
 * Voice V3 spam & solicitor protection — unit + integration-style checks.
 * Run: npx tsx scripts/test-voice-v3-spam-solicitor-protection.ts
 */
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  telnyxInboundScreeningForPolicy,
  normalizeTelnyxScreeningValue,
  wizardSpamProtectionFromState,
  type VoiceV3SpamLikelyPolicy,
  type VoiceV3SolicitorPolicy,
} from "../src/lib/voice-v3/spam-protection/types";
import { isUnwantedSolicitorBillingApplied } from "../src/lib/voice-v3/spam-protection/billing";
import { buildCallScreeningUi } from "../src/lib/voice/calls/screening-display";

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

function testWizardMatrix() {
  const spamPolicies: VoiceV3SpamLikelyPolicy[] = ["BLOCK", "SCREEN", "ALLOW"];
  const solicitorPolicies: VoiceV3SolicitorPolicy[] = ["DECLINE", "TAKE_MESSAGE", "ALLOW"];
  for (const spam of spamPolicies) {
    for (const sol of solicitorPolicies) {
      const w = createDefaultWizardState();
      w.spamLikelyPolicy = spam;
      w.solicitorPolicy = sol;
      const compiled = compileVoiceV3AgentConfig({ wizard: w, source: "wizard_published" });
      assert.equal(compiled.spamProtection.spamLikelyPolicy, spam);
      assert.equal(compiled.spamProtection.solicitorPolicy, sol);
      assert.equal(telnyxInboundScreeningForPolicy(spam), spam === "BLOCK" ? "reject_calls" : "flag_calls");
    }
  }
}

/** SYNTHETIC — not carrier certification */
function testSyntheticSipHeaderScreening() {
  const normalized = normalizeTelnyxScreeningValue("SPAM LIKELY");
  assert.equal(normalized, "spam_likely");
  const ui = buildCallScreeningUi({
    metadata: {
      voiceV3Screening: {
        carrierScreeningRaw: "SPAM LIKELY",
        carrierScreeningNormalized: "spam_likely",
        suspectedSpamLikely: true,
        spamLikelyPolicy: "SCREEN",
      },
    },
    outcome: null,
  });
  assert.ok(ui.extraBadges.includes("Spam Likely"));
}

function testBillingIdempotencyFlag() {
  const applied = {
    voiceV3Screening: {
      customerBillable: false,
      transovoOutcome: "UNWANTED_SOLICITATION",
    },
  };
  assert.equal(isUnwantedSolicitorBillingApplied(applied), true);
  assert.equal(isUnwantedSolicitorBillingApplied({ voiceV3Screening: {} }), false);
}

function testSolicitorUiBadge() {
  const ui = buildCallScreeningUi({
    metadata: {
      voiceV3Screening: {
        transovoOutcome: "UNWANTED_SOLICITATION",
        customerBillable: false,
      },
    },
    outcome: "unwanted_solicitation",
  });
  assert.ok(ui.extraBadges.includes("Solicitor"));
  assert.equal(ui.billingLabel, "Not charged");
}

function main() {
  testTelnyxMapping();
  testNormalizeScreening();
  testWizardRoundTrip();
  testLegacyCompat();
  testWizardMatrix();
  testSyntheticSipHeaderScreening();
  testBillingIdempotencyFlag();
  testSolicitorUiBadge();
  console.log("PASS voice-v3-spam-solicitor-protection");
}

main();
