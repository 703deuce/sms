/**
 * MCTB Lead Handoff & Notifications — certification contract tests (finite, no live providers).
 * Run: npx tsx scripts/test-mctb-handoff.ts
 */
import assert from "node:assert/strict";
import { defaultHandoffConfig } from "../src/lib/mctb/handoff/defaults";
import {
  guidedCollectionComplete,
  nextGuidedField,
  detectCallbackIntent,
} from "../src/lib/mctb/handoff/guided-collection";
import { assessMctbUrgency, isUrgentClassification } from "../src/lib/mctb/handoff/urgency";
import { renderMctbTeamSms } from "../src/lib/mctb/handoff/templates";
import { MCTB_RESPONSE_MODES } from "../src/lib/mctb/handoff/types";

function testResponseModesDistinct() {
  assert.equal(MCTB_RESPONSE_MODES.length, 4);
  assert.deepEqual(new Set(MCTB_RESPONSE_MODES).size, 4);
}

function testUrgencyCriteria() {
  const config = defaultHandoffConfig();
  config.emergencyDetectionEnabled = true;
  config.emergencyCriteria = "burst pipe, flooding";
  const urgent = assessMctbUrgency({
    customerText: "We have a burst pipe in the basement",
    config,
  });
  assert.ok(urgent);
  assert.equal(urgent!.classification, "urgent");
  assert.ok(isUrgentClassification(urgent));
}

function testNonEmergency() {
  const config = defaultHandoffConfig();
  config.emergencyDetectionEnabled = true;
  config.emergencyCriteria = "flooding";
  config.emergencyUncertainBehavior = "treat_normal";
  const normal = assessMctbUrgency({
    customerText: "I need a quote for a water heater",
    config,
  });
  assert.ok(normal);
  assert.equal(normal!.classification, "normal");
  assert.equal(isUrgentClassification(normal), false);
}

function testGuidedCollectionRequired() {
  const config = defaultHandoffConfig();
  config.responseMode = "guided_collection";
  const captured: Record<string, unknown> = {};
  const first = nextGuidedField(config, captured);
  assert.ok(first);
  assert.equal(first!.id, "service_reason");
  captured.service_reason = "Water heater estimate";
  captured.caller_name = "Anthony";
  assert.equal(guidedCollectionComplete(config, captured), true);
}

function testCallbackIntent() {
  assert.equal(detectCallbackIntent("Please call me back after 4"), true);
  assert.equal(detectCallbackIntent("Just a quote thanks"), false);
}

function testSmsTemplateNoFabrication() {
  const sms = renderMctbTeamSms({
    businessName: "Acme",
    eventType: "lead_captured",
    facts: {
      callerName: "Anthony",
      callerPhone: "+15715551234",
      serviceReason: "Water heater",
    },
  });
  assert.match(sms, /Anthony/);
  assert.match(sms, /Water heater/);
  assert.doesNotMatch(sms, /undefined/);
}

testResponseModesDistinct();
testUrgencyCriteria();
testNonEmergency();
testGuidedCollectionRequired();
testCallbackIntent();
testSmsTemplateNoFabrication();

console.log("test-mctb-handoff: PASS");
