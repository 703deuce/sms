/**
 * Power dialer ultra-low-latency policy + parallel winner unit checks.
 * Run: npx tsx new-app/scripts/test-power-dialer-low-latency.ts
 */
import assert from "node:assert/strict";
import {
  allowsImmediateBridgeOnAnswer,
  resolveConnectionPolicy,
} from "../lib/server/phone/power-dialer/connection-policy";
import { pickBridgeWinner } from "../lib/server/phone/power-dialer/parallel-orchestrator";

function testConnectionPolicy() {
  const parallelFast = resolveConnectionPolicy({
    dialMode: "parallel",
    amdFilterMachines: false,
    iosScreeningWireActive: false,
    screeningPending: false,
  });
  assert.equal(parallelFast.fastConnectOnProspectAnswer, true);
  assert.equal(parallelFast.requiresConfirmedHumanBeforeBridge, false);

  const parallelAmd = resolveConnectionPolicy({
    dialMode: "parallel_amd",
    amdFilterMachines: true,
    iosScreeningWireActive: false,
  });
  assert.equal(parallelAmd.fastConnectOnProspectAnswer, false);
  assert.equal(parallelAmd.requiresConfirmedHumanBeforeBridge, true);

  const iosGate = resolveConnectionPolicy({
    dialMode: "parallel",
    amdFilterMachines: false,
    iosScreeningWireActive: true,
  });
  assert.equal(iosGate.fastConnectOnProspectAnswer, false);

  assert.equal(
    allowsImmediateBridgeOnAnswer({
      dialMode: "power",
      amdFilterMachines: false,
      iosScreeningWireActive: false,
    }),
    true,
  );
}

function testPickBridgeWinnerTieBreak() {
  const winner = pickBridgeWinner([
    { attemptId: "b", answeredAtMs: 100 },
    { attemptId: "a", answeredAtMs: 100 },
  ]);
  assert.equal(winner, "a");
}

function testSourceContracts() {
  const fs = require("node:fs") as typeof import("node:fs");
  const bridge = fs.readFileSync(
    "lib/server/phone/power-dialer/power-dialer-leg-bridge.ts",
    "utf8",
  );
  assert.ok(bridge.includes("bridgeCallsWithBenchmark"));
  assert.ok(bridge.includes("classificationSatisfiesBridgeGate"));

  const orch = fs.readFileSync(
    "lib/server/phone/power-dialer/parallel-orchestrator.ts",
    "utf8",
  );
  assert.ok(orch.includes("tryAtomicParallelWinnerClaim"));

  const calls = fs.readFileSync("lib/server/phone/calls-service.ts", "utf8");
  assert.ok(calls.includes("maybeFastConnectPowerDialerOnAnswer"));
  assert.ok(calls.includes("pd_session_warm_agent"));
}

function main() {
  testConnectionPolicy();
  testPickBridgeWinnerTieBreak();
  testSourceContracts();
  console.log("test-power-dialer-low-latency: PASS");
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
