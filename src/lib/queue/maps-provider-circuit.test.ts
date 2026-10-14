import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  __resetMapsProviderCircuitForTests,
  evaluateDegradationWindow,
  recordMapsProviderAttempt,
  getMapsProviderCircuit,
  setMapsProviderCircuit,
} from "@/lib/queue/maps-provider-circuit";

describe("maps provider circuit breaker", () => {
  beforeEach(() => {
    __resetMapsProviderCircuitForTests();
  });

  it("opens when ≥30% of last 20 samples are degradation failures (min 10)", () => {
    // 10 samples: 3 degradation = 30% → open
    const samples = [
      ...Array.from({ length: 7 }, () => ({ failure: false, degradation: false })),
      ...Array.from({ length: 3 }, () => ({ failure: true, degradation: true })),
    ];
    const decision = evaluateDegradationWindow(samples);
    assert.equal(decision.shouldOpen, true);
    assert.ok(decision.percent >= 30);
  });

  it("does not open below min sample count", () => {
    const samples = Array.from({ length: 9 }, () => ({
      failure: true,
      degradation: true,
    }));
    const decision = evaluateDegradationWindow(samples);
    assert.equal(decision.shouldOpen, false);
  });

  it("recordMapsProviderAttempt opens the circuit from closed", async () => {
    for (let i = 0; i < 7; i++) {
      await recordMapsProviderAttempt({
        provider: "brightdata",
        success: true,
        category: "success",
      });
    }
    for (let i = 0; i < 3; i++) {
      await recordMapsProviderAttempt({
        provider: "brightdata",
        success: false,
        category: "http_504",
      });
    }
    const circuit = await getMapsProviderCircuit("brightdata");
    assert.equal(circuit.state, "open");
    assert.ok(circuit.openStreak >= 1);
  });

  it("open expiry transitions to half_open", async () => {
    await setMapsProviderCircuit("brightdata", "open", "test", {
      openStreak: 1,
      leaseMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    const circuit = await getMapsProviderCircuit("brightdata");
    assert.equal(circuit.state, "half_open");
  });
});
