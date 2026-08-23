import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  brightDataCircuitOpenDurationMs,
  brightDataGlobalConcurrency,
  brightDataHealthyConcurrency,
  brightDataRecoveryDeadlineMs,
  brightDataRecoverySchedule,
  brightDataRetryDelayMaxMs,
  brightDataRetryDelayMinMs,
  brightDataRetryDelayMs,
} from "@/lib/providers/maps-grid/config";
import {
  adaptiveBrightDataConcurrency,
  recoveryRoundConcurrency,
  recoveryRoundDelayMs,
} from "@/lib/providers/maps-grid/batch-recovery";

describe("Bright Data short jittered recovery config", () => {
  const keys = [
    "BRIGHTDATA_GLOBAL_CONCURRENCY",
    "BRIGHTDATA_HEALTHY_CONCURRENCY",
    "BRIGHTDATA_RECOVERY_DEADLINE_MS",
    "BRIGHTDATA_RETRY_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY_MAX_ROUNDS",
    "BRIGHTDATA_RETRY_CONCURRENCY",
    "BRIGHTDATA_CIRCUIT_OPEN_BASE_MS",
    "BRIGHTDATA_CIRCUIT_OPEN_MAX_MS",
  ];
  const prev: Record<string, string | undefined> = {};

  before(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  after(() => {
    for (const k of keys) {
      if (prev[k] == null) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("defaults global concurrency to 10 (paced trial)", () => {
    assert.equal(brightDataGlobalConcurrency(), 10);
    assert.equal(brightDataHealthyConcurrency(), 10);
  });

  it("retries unfinished cells every 8–15s with a 10 minute deadline", () => {
    assert.equal(brightDataRetryDelayMinMs(), 8_000);
    assert.equal(brightDataRetryDelayMaxMs(), 15_000);
    assert.equal(brightDataRecoveryDeadlineMs(), 10 * 60_000);

    const delay = brightDataRetryDelayMs();
    assert.ok(delay >= 8_000 && delay <= 15_000);

    const schedule = brightDataRecoverySchedule();
    assert.ok(schedule.length >= 20);
    assert.equal(schedule[0].delayMinMs, 8_000);
    assert.equal(schedule[0].delayMaxMs, 15_000);
    assert.equal(schedule[0].concurrency, 10);
    const roundDelay = recoveryRoundDelayMs(schedule[0]);
    assert.ok(roundDelay >= 8_000 && roundDelay <= 15_000);
    assert.equal(recoveryRoundConcurrency(schedule[0], 11), 10);
  });

  it("circuit open durations escalate 30s → 60s → 120s → 240s → 300s cap", () => {
    assert.equal(brightDataCircuitOpenDurationMs(0), 30_000);
    assert.equal(brightDataCircuitOpenDurationMs(1), 60_000);
    assert.equal(brightDataCircuitOpenDurationMs(2), 120_000);
    assert.equal(brightDataCircuitOpenDurationMs(3), 240_000);
    assert.equal(brightDataCircuitOpenDurationMs(4), 300_000);
    assert.equal(brightDataCircuitOpenDurationMs(8), 300_000);
  });

  it("adaptive concurrency steps down with success rate", () => {
    assert.equal(adaptiveBrightDataConcurrency(0.99), 10);
    assert.equal(adaptiveBrightDataConcurrency(0.9), 8);
    assert.equal(adaptiveBrightDataConcurrency(0.75), 4);
    assert.equal(adaptiveBrightDataConcurrency(0.5), 2);
  });
});
