import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzePrimaryWave,
  isolatedRetryConcurrency,
  probesRecovered,
  selectProbeJobs,
} from "@/lib/providers/maps-grid/batch-recovery";
import { evaluateDegradationWindow } from "@/lib/queue/maps-provider-circuit";
import {
  categoryFromHttpStatus,
  isTransientMapsFailure,
} from "@/lib/providers/maps-grid/failure-categories";

describe("Maps batch recovery policy", () => {
  it("keeps healthy 25/25 without degraded mode", () => {
    const outcomes = Array.from({ length: 25 }, () => ({
      success: true as const,
      category: "success" as const,
    }));
    const analysis = analyzePrimaryWave(outcomes);
    assert.equal(analysis.mode, "healthy");
    assert.equal(analysis.shouldDegrade, false);
  });

  it("treats one or two failures as isolated, not degraded", () => {
    const outcomes = [
      ...Array.from({ length: 23 }, () => ({
        success: true as const,
        category: "success" as const,
      })),
      { success: false as const, category: "http_504" as const },
      { success: false as const, category: "http_504" as const },
    ];
    const analysis = analyzePrimaryWave(outcomes);
    assert.equal(analysis.mode, "isolated");
    assert.equal(analysis.shouldDegrade, false);
  });

  it("opens degraded mode for 18/25 simultaneous 504s", () => {
    const outcomes = [
      ...Array.from({ length: 7 }, () => ({
        success: true as const,
        category: "success" as const,
      })),
      ...Array.from({ length: 18 }, () => ({
        success: false as const,
        category: "http_504" as const,
      })),
    ];
    const analysis = analyzePrimaryWave(outcomes);
    assert.equal(analysis.mode, "degraded");
    assert.equal(analysis.shouldDegrade, true);
    assert.ok(analysis.degradationCount >= 5);
    assert.ok(analysis.percent >= 25);
  });

  it("caps isolated retry concurrency at 5", () => {
    assert.equal(isolatedRetryConcurrency(18), 5);
    assert.equal(isolatedRetryConcurrency(2), 2);
  });

  it("requires at least 2 probe successes to resume", () => {
    assert.equal(probesRecovered(1), false);
    assert.equal(probesRecovered(2), true);
  });

  it("selects a spread of probe jobs", () => {
    const jobs = Array.from({ length: 20 }, (_, i) => i);
    const probes = selectProbeJobs(jobs, 3);
    assert.equal(probes.length, 3);
    assert.ok(new Set(probes).size === 3);
  });

  it("distinguishes HTTP 504 from valid empty maps results", () => {
    assert.equal(categoryFromHttpStatus(504), "http_504");
    assert.equal(isTransientMapsFailure("http_504"), true);
    assert.equal(isTransientMapsFailure("valid_empty_maps_results"), false);
  });

  it("evaluateDegradationWindow matches threshold math", () => {
    const samples = [
      ...Array.from({ length: 7 }, () => ({ failure: false, degradation: false })),
      ...Array.from({ length: 18 }, () => ({ failure: true, degradation: true })),
    ];
    const d = evaluateDegradationWindow(samples, { minFailures: 5, thresholdPercent: 25 });
    assert.equal(d.shouldDegrade, true);
  });
});
