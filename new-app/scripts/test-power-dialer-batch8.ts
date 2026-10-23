/**
 * Batch 8 — parallel/predictive pacing, abandonment, bridge race, transfer FSM, gates (no live Telnyx).
 */
import assert from "node:assert/strict";
import { computePredictiveLines } from "../lib/server/phone/power-dialer/predictive-pacing";
import {
  evaluateAbandonmentSafeguards,
  DEFAULT_ABANDONMENT_POLICY,
} from "../lib/server/phone/power-dialer/abandonment-policy";
import { pickBridgeWinner } from "../lib/server/phone/power-dialer/parallel-orchestrator";
import {
  evaluateDialModeGate,
  parseAdvancedDialEntitlements,
  effectiveParallelLineCount,
} from "../lib/server/phone/power-dialer/dial-modes";
import { parseWarmTransferState } from "../lib/server/phone/power-dialer/warm-transfer";
import { getPowerDialerConcurrencyLimits } from "../lib/server/phone/power-dialer/usage-limits";

function testPredictiveStaysUnderCap() {
  const result = computePredictiveLines({
    repsAvailable: 2,
    repsOnCall: 0,
    historicalAnswerRate: 0.15,
    targetAbandonRatePct: 3,
    maxLinesPerRep: 5,
    aggression: 1.2,
    currentAbandonRatePct: 2.8,
    hardStopAbandonPct: 3,
  });
  assert.ok(result.linesToDial >= 1);
  assert.equal(result.hardStop, false);
  const hard = computePredictiveLines({
    repsAvailable: 2,
    repsOnCall: 0,
    historicalAnswerRate: 0.15,
    targetAbandonRatePct: 3,
    maxLinesPerRep: 5,
    aggression: 2,
    currentAbandonRatePct: 3.1,
    hardStopAbandonPct: 3,
  });
  assert.equal(hard.linesToDial, 0);
  assert.equal(hard.hardStop, true);
  console.log("predictive-pacing: PASS");
}

function testAbandonThrottle() {
  const ev = evaluateAbandonmentSafeguards(DEFAULT_ABANDONMENT_POLICY, {
    abandonedCount: 26,
    connectedCount: 974,
  });
  assert.equal(ev.autoThrottle, true);
  assert.equal(ev.hardStop, false);
  const stop = evaluateAbandonmentSafeguards(DEFAULT_ABANDONMENT_POLICY, {
    abandonedCount: 4,
    connectedCount: 96,
  });
  assert.equal(stop.hardStop, true);
  console.log("abandonment-policy: PASS");
}

function testBridgeFirstAnswer() {
  const winner = pickBridgeWinner([
    { attemptId: "b", answeredAtMs: 100 },
    { attemptId: "a", answeredAtMs: 100 },
  ]);
  assert.equal(winner, "a");
  const solo = pickBridgeWinner([{ attemptId: "z", answeredAtMs: 50 }]);
  assert.equal(solo, "z");
  console.log("bridge-first-answer: PASS");
}

function testConcurrencyKillSwitchType() {
  assert.equal(typeof getPowerDialerConcurrencyLimits, "function");
  console.log("concurrency-kill-switch: PASS");
}

function testDialModeGates() {
  const ent = parseAdvancedDialEntitlements({ powerDialer: { advancedDialModes: {} } });
  assert.equal(ent.parallelEnabled, false);
  const blocked = evaluateDialModeGate({ mode: "parallel", entitlements: ent });
  assert.equal(blocked.allowed, false);
  const on = parseAdvancedDialEntitlements({
    powerDialer: { advancedDialModes: { parallelEnabled: true, predictiveEnabled: true } },
  });
  const ok = evaluateDialModeGate({ mode: "predictive", entitlements: on });
  assert.equal(ok.allowed, true);
  const lines = effectiveParallelLineCount("parallel", { parallelLines: 9 }, on);
  assert.ok(lines <= on.maxParallelLines);
  console.log("dial-mode-gates: PASS");
}

function testTransferStateMachine() {
  const state = parseWarmTransferState({
    phase: "consulting",
    attemptId: "a1",
    targetE164: "+15551234567",
    updatedAt: new Date().toISOString(),
  });
  assert.equal(state?.phase, "consulting");
  console.log("transfer-fsm: PASS");
}

async function main() {
  testPredictiveStaysUnderCap();
  testAbandonThrottle();
  testBridgeFirstAnswer();
  testConcurrencyKillSwitchType();
  testDialModeGates();
  testTransferStateMachine();
  console.log("power-dialer-batch8: ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
