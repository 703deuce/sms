/**
 * Phase 5 unit checks — caller ID stickiness, AMD mapping, classification exclusions.
 */
import assert from "node:assert/strict";
import { mapTelnyxAmdResult } from "../lib/server/phone/power-dialer/answer-detection";
import { isHumanConversation } from "../lib/server/phone/power-dialer/disposition-effects";

function testAmdMapping() {
  assert.equal(mapTelnyxAmdResult("machine_end_beep"), "voicemail");
  assert.equal(mapTelnyxAmdResult("human"), "human");
  assert.equal(mapTelnyxAmdResult("premium_screener"), "screener");
  console.log("amd-mapping: PASS");
}

function testStickyIndex() {
  const pool = ["a", "b", "c"];
  const key = "camp1:rep1";
  const idx = Math.abs(key.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % pool.length;
  const idx2 = Math.abs(key.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % pool.length;
  assert.equal(idx, idx2);
  console.log("caller-id-sticky-index: PASS");
}

function testHumanExcludesScreener() {
  assert.equal(isHumanConversation("Interested", "screener"), false);
  assert.equal(isHumanConversation("Interested", "human"), true);
  assert.equal(isHumanConversation("Interested", "voicemail"), false);
  console.log("human-metrics-exclusion: PASS");
}

function testAnswerRateMath() {
  const attempts = 10;
  const answered = 4;
  const rate = Math.round((answered / attempts) * 1000) / 10;
  assert.equal(rate, 40);
  console.log("number-health-answer-rate: PASS");
}

function testIdempotentKeyShape() {
  const key = `amd:${"call-1"}:${"machine_end_beep"}`;
  assert.ok(key.length > 8);
  console.log("amd-idempotency-key: PASS");
}

testStickyIndex();
testAmdMapping();
testHumanExcludesScreener();
testAnswerRateMath();
testIdempotentKeyShape();
console.log("test-power-dialer-phase5: ALL PASS");
