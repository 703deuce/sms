import {
  brightDataDegradedMinFailures,
  brightDataDegradedThresholdPercent,
  brightDataHealthyConcurrency,
  brightDataIsolatedRetryConcurrency,
  brightDataIsolatedRetryDelayMaxMs,
  brightDataIsolatedRetryDelayMinMs,
  brightDataProbeCount,
  brightDataProbeSuccessMin,
  brightDataRecoveryDelayMaxMs,
  brightDataRecoveryDelayMinMs,
  brightDataRecoverySchedule,
  brightDataRetryDelayMs,
  jitterMs,
  type BrightDataRecoveryRound,
} from "@/lib/providers/maps-grid/config";
import {
  evaluateDegradationWindow,
  type DegradationDecision,
} from "@/lib/queue/maps-provider-circuit";
import type { MapsFailureCategory } from "@/lib/providers/maps-grid/failure-categories";
import { isProviderDegradationPattern } from "@/lib/providers/maps-grid/failure-categories";

export type CellOutcomeSample = {
  success: boolean;
  category: MapsFailureCategory;
};

export function analyzePrimaryWave(outcomes: CellOutcomeSample[]): DegradationDecision & {
  mode: "healthy" | "isolated" | "degraded";
} {
  const samples = outcomes.map((o) => ({
    failure: !o.success,
    degradation: !o.success && isProviderDegradationPattern(o.category),
  }));
  const decision = evaluateDegradationWindow(samples, {
    minFailures: brightDataDegradedMinFailures(),
    thresholdPercent: brightDataDegradedThresholdPercent(),
  });
  if (decision.shouldOpen || decision.shouldDegrade) {
    return { ...decision, mode: "degraded" };
  }
  const failures = outcomes.filter((o) => !o.success).length;
  if (failures === 0) return { ...decision, mode: "healthy" };
  return { ...decision, mode: "isolated" };
}

export function isolatedRetryConcurrency(failedCount: number): number {
  return Math.min(Math.max(failedCount, 0), brightDataIsolatedRetryConcurrency());
}

export function isolatedRetryDelayMs(): number {
  return jitterMs(brightDataIsolatedRetryDelayMinMs(), brightDataIsolatedRetryDelayMaxMs());
}

export function degradedRecoveryDelayMs(): number {
  return jitterMs(brightDataRecoveryDelayMinMs(), brightDataRecoveryDelayMaxMs());
}

export function selectProbeJobs<T>(jobs: T[], count = brightDataProbeCount()): T[] {
  if (jobs.length <= count) return [...jobs];
  const step = Math.max(1, Math.floor(jobs.length / count));
  const out: T[] = [];
  for (let i = 0; i < jobs.length && out.length < count; i += step) {
    out.push(jobs[i]);
  }
  while (out.length < count && out.length < jobs.length) {
    const next = jobs[out.length];
    if (!out.includes(next)) out.push(next);
    else break;
  }
  return out;
}

export function probesRecovered(successCount: number): boolean {
  return successCount >= brightDataProbeSuccessMin();
}

export function brightDataPrimaryConcurrency(cellCount: number): number {
  return Math.min(Math.max(cellCount, 0), brightDataHealthyConcurrency());
}

export function recoveryRoundDelayMs(round?: BrightDataRecoveryRound): number {
  if (round) return jitterMs(round.delayMinMs, round.delayMaxMs);
  return brightDataRetryDelayMs();
}

export function recoveryRoundConcurrency(
  round: BrightDataRecoveryRound,
  failedCount: number
): number {
  return Math.min(Math.max(failedCount, 0), round.concurrency);
}

export function listBrightDataRecoveryRounds(): BrightDataRecoveryRound[] {
  return brightDataRecoverySchedule();
}

/**
 * Adaptive concurrency from a rolling success rate (0–1).
 * ≥95% → healthy · 85–94% → 8 · 70–84% → 4 · below 70% → 2 (circuit should open separately).
 */
export function adaptiveBrightDataConcurrency(successRate: number): number {
  const healthy = brightDataHealthyConcurrency();
  if (!Number.isFinite(successRate)) return healthy;
  if (successRate >= 0.95) return healthy;
  if (successRate >= 0.85) return Math.min(healthy, 8);
  if (successRate >= 0.7) return Math.min(healthy, 4);
  return Math.min(healthy, 2);
}
