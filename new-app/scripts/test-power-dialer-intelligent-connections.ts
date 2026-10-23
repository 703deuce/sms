/**
 * Intelligent Connections — mocked Telnyx AMD / screening lifecycle (no PSTN).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapTelnyxAmdResult,
  mapTelnyxScreeningDetected,
  classificationBlocksParallelWinner,
  isConfirmedHumanClassification,
} from "../lib/server/phone/power-dialer/answer-classification";
import { pickBridgeWinner, assertParallelWinnerEligible } from "../lib/server/phone/power-dialer/parallel-orchestrator";
import { deriveConnectionPhase, connectionPhaseLabel } from "../lib/server/phone/power-dialer/connection-intelligence";
import { buildPowerDialerCallSource } from "../lib/server/phone/power-dialer/call-source-label";
import { isHumanConversation } from "../lib/server/phone/power-dialer/disposition-effects";

const fixtures = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/power-dialer-amd-webhooks.json"), "utf8"),
) as { eventType?: string; result: string; expectedClassification: string }[];

for (const row of fixtures) {
  const c =
    row.eventType === "call.machine.premium.call_screening.detected"
      ? mapTelnyxScreeningDetected(row.result)
      : mapTelnyxAmdResult(row.result);
  assert.equal(c, row.expectedClassification, `fixture ${row.result}`);
}
console.log("amd fixture mappings: PASS");

assert.equal(mapTelnyxAmdResult("machine"), "machine");
assert.equal(mapTelnyxAmdResult("human_residence"), "human");
assert.equal(mapTelnyxScreeningDetected("screening"), "screener");
assert.equal(mapTelnyxScreeningDetected("other"), "uncertain");
assert.ok(!mapTelnyxAmdResult("screening").includes("screener") || mapTelnyxAmdResult("screening") === "uncertain");
console.log("classification layer: PASS");

assert.ok(classificationBlocksParallelWinner("voicemail", true));
assert.ok(classificationBlocksParallelWinner("screener", false));
assert.ok(!classificationBlocksParallelWinner("human", true));
assert.ok(classificationBlocksParallelWinner("uncertain", true));
console.log("parallel filter policy: PASS");

assert.ok(!isHumanConversation(null, "screener"));
assert.ok(!isHumanConversation(null, "machine"));
assert.ok(isHumanConversation(null, "human"));
console.log("human conversation KPI: PASS");

const winner = pickBridgeWinner([
  { attemptId: "b", answeredAtMs: 200 },
  { attemptId: "a", answeredAtMs: 100 },
]);
assert.equal(winner, "a");
console.log("parallel race: PASS");

const phase = deriveConnectionPhase({
  attemptStatus: "answered",
  answerClassification: "screener",
  screeningPending: true,
});
assert.equal(phase, "waiting_for_recipient");
assert.ok(connectionPhaseLabel(phase).includes("Waiting"));
console.log("connection phases: PASS");

const withoutWire = buildPowerDialerCallSource({
  source: "power_dialer",
  answerClassification: "screener",
  attemptMetadata: { screeningPending: true, iosScreeningWireActive: false },
});
assert.equal(withoutWire.screeningDetected, false);
const withWire = buildPowerDialerCallSource({
  source: "power_dialer",
  answerClassification: "screener",
  attemptMetadata: { screeningPending: true, iosScreeningWireActive: true },
});
assert.equal(withWire.screeningDetected, true);
console.log("call history screening flags: PASS");

const amdSrc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/power-dialer-amd.ts"),
  "utf8",
);
const policySrc = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/amd-policy.ts"),
  "utf8",
);
assert.ok(amdSrc.includes("resolvePowerDialerAmdStartPlan"));
assert.ok(!amdSrc.includes("PremiumCallScreening"));
assert.ok(policySrc.includes("premium_ios_call_screening_detection"));
assert.ok(policySrc.includes("requested_pending_dial_origination"));
assert.ok(policySrc.includes('amdStartDetectionMode: "Premium"'));
console.log("amd start policy wired: PASS");

// assertParallelWinnerEligible needs DB — smoke import only
assert.equal(typeof assertParallelWinnerEligible, "function");
console.log("intelligent-connections tests: ALL PASS");
