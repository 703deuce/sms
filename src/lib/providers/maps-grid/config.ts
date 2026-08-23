/**
 * Maps grid multi-provider configuration.
 * All tunables live here as env-backed getters — no scattered magic numbers.
 *
 * Production Bright Data policy (defaults — paced trial):
 * - 10 cells per wave, wait for the wave to finish, then at most 10 starts/minute
 * - Unfinished-only retries every 8–15s (jitter) until all done or 10 min deadline
 * - Bright Data only (no ScrapingDog mix)
 * - No circuit-breaker skip — every unfinished cell is attempted on schedule
 */

function envInt(name: string, fallback: number, opts?: { min?: number; max?: number }): number {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  const min = opts?.min ?? Number.NEGATIVE_INFINITY;
  const max = opts?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

/**
 * Bright Data global in-flight concurrency for Maps cells (across workers).
 * Default 10 = one paced wave (raise via env to restore burst).
 */
export function brightDataGlobalConcurrency(): number {
  return envInt("BRIGHTDATA_GLOBAL_CONCURRENCY", 10, { min: 1, max: 250 });
}

/**
 * Max Bright Data cell starts per rolling minute (across workers).
 * Paired with wave size 10: launch 10 → wait for finish → next 10 after the minute.
 */
export function brightDataStartRatePerMin(): number {
  return envInt("BRIGHTDATA_GLOBAL_START_RATE_PER_MIN", 10, { min: 1, max: 6000 });
}

/**
 * Minimum spacing between primary waves (ms), measured from wave start.
 * Default 60s so completed fast waves still respect “10 per minute.”
 */
export function brightDataWaveIntervalMs(): number {
  return envInt("BRIGHTDATA_WAVE_INTERVAL_MS", 60_000, { min: 0, max: 600_000 });
}

/**
 * Optional lower cap for adaptive mid-scan throttle (circuit recovery ramps).
 * Primary pass uses mapsGridConcurrency (up to wave size), not this.
 */
export function brightDataHealthyConcurrency(): number {
  return envInt("BRIGHTDATA_HEALTHY_CONCURRENCY", brightDataGlobalConcurrency(), {
    min: 1,
    max: 250,
  });
}

export function brightDataNormalCellTimeoutMs(): number {
  return envInt("BRIGHTDATA_NORMAL_CELL_TIMEOUT_MS", 45_000, { min: 5_000, max: 180_000 });
}

/** Rolling sample size for the Bright Data circuit (last N attempts). */
export function brightDataCircuitSampleSize(): number {
  return envInt("BRIGHTDATA_CIRCUIT_SAMPLE_SIZE", 20, { min: 5, max: 200 });
}

/** Open circuit when degradation % over the sample window reaches this. */
export function brightDataCircuitOpenThresholdPercent(): number {
  return envInt("BRIGHTDATA_CIRCUIT_OPEN_THRESHOLD_PERCENT", 30, { min: 1, max: 100 });
}

/** Require at least this many samples before opening the circuit. */
export function brightDataCircuitMinSamples(): number {
  return envInt("BRIGHTDATA_CIRCUIT_MIN_SAMPLES", 10, { min: 1, max: 200 });
}

/** @deprecated Prefer brightDataCircuitOpenThresholdPercent — kept for analyzePrimaryWave callers. */
export function brightDataDegradedThresholdPercent(): number {
  return envInt(
    "BRIGHTDATA_DEGRADED_THRESHOLD_PERCENT",
    brightDataCircuitOpenThresholdPercent(),
    { min: 1, max: 100 }
  );
}

/** @deprecated Prefer brightDataCircuitMinSamples. */
export function brightDataDegradedMinFailures(): number {
  return envInt("BRIGHTDATA_DEGRADED_MIN_FAILURES", brightDataCircuitMinSamples(), {
    min: 1,
    max: 500,
  });
}

/** Soft time prune for Redis window entries (sample-count is authoritative). */
export function brightDataDegradedWindowMs(): number {
  return envInt("BRIGHTDATA_DEGRADED_WINDOW_MS", 600_000, { min: 1_000, max: 3_600_000 });
}

export function brightDataIsolatedRetryConcurrency(): number {
  return envInt("BRIGHTDATA_ISOLATED_RETRY_CONCURRENCY", 5, { min: 1, max: 25 });
}

export function brightDataIsolatedRetryDelayMinMs(): number {
  return envInt("BRIGHTDATA_ISOLATED_RETRY_DELAY_MIN_MS", 2_000, { min: 0, max: 60_000 });
}

export function brightDataIsolatedRetryDelayMaxMs(): number {
  return envInt("BRIGHTDATA_ISOLATED_RETRY_DELAY_MAX_MS", 5_000, { min: 0, max: 120_000 });
}

export function brightDataRecoveryDelayMinMs(): number {
  return envInt("BRIGHTDATA_RECOVERY_DELAY_MIN_MS", 12_000, { min: 0, max: 180_000 });
}

export function brightDataRecoveryDelayMaxMs(): number {
  return envInt("BRIGHTDATA_RECOVERY_DELAY_MAX_MS", 20_000, { min: 0, max: 300_000 });
}

export function brightDataProbeCount(): number {
  return envInt("BRIGHTDATA_PROBE_COUNT", 2, { min: 1, max: 10 });
}

export function brightDataProbeConcurrency(): number {
  return envInt("BRIGHTDATA_PROBE_CONCURRENCY", 1, { min: 1, max: 5 });
}

export function brightDataProbeSuccessMin(): number {
  return envInt("BRIGHTDATA_PROBE_SUCCESS_MIN", 2, { min: 1, max: 10 });
}

export function brightDataHalfOpenConcurrency(): number {
  return envInt("BRIGHTDATA_HALF_OPEN_CONCURRENCY", 4, { min: 1, max: 50 });
}

export function brightDataHalfOpenRampConcurrency(): number {
  return envInt("BRIGHTDATA_HALF_OPEN_RAMP_CONCURRENCY", 8, { min: 1, max: 100 });
}

/** Initial open duration when the circuit first trips. */
export function brightDataCircuitOpenBaseMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_OPEN_BASE_MS", 30_000, { min: 1_000, max: 600_000 });
}

/** Cap for escalated open periods (~5 minutes). */
export function brightDataCircuitOpenMaxMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_OPEN_MAX_MS", 300_000, { min: 5_000, max: 900_000 });
}

/**
 * Hard ceiling for the full Bright Data recovery window
 * (primary burst + short jittered retries until done).
 */
export function brightDataRecoveryDeadlineMs(): number {
  return envInt("BRIGHTDATA_RECOVERY_DEADLINE_MS", 10 * 60_000, {
    min: 60_000,
    max: 45 * 60_000,
  });
}

/** Min wait between unfinished-cell Bright Data retry rounds. */
export function brightDataRetryDelayMinMs(): number {
  return envInt("BRIGHTDATA_RETRY_DELAY_MIN_MS", 8_000, { min: 0, max: 120_000 });
}

/** Max wait between unfinished-cell Bright Data retry rounds (jitter upper bound). */
export function brightDataRetryDelayMaxMs(): number {
  return envInt("BRIGHTDATA_RETRY_DELAY_MAX_MS", 15_000, { min: 0, max: 180_000 });
}

/** Jittered delay before the next unfinished-cell retry round. */
export function brightDataRetryDelayMs(): number {
  return jitterMs(brightDataRetryDelayMinMs(), brightDataRetryDelayMaxMs());
}

/**
 * @deprecated Prefer brightDataRecoverySchedule() tiers.
 * Kept so older env knobs still parse in tests/ops.
 */
export function brightDataDelayedRetryDelayMs(): number {
  return envInt("BRIGHTDATA_DELAYED_RETRY_DELAY_MS", 30_000, { min: 0, max: 300_000 });
}

/** @deprecated Prefer brightDataRecoverySchedule() length. */
export function brightDataDelayedRetryRounds(): number {
  return envInt("BRIGHTDATA_DELAYED_RETRY_ROUNDS", 3, { min: 0, max: 8 });
}

export function brightDataCircuitLeaseMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_LEASE_MS", 600_000, { min: 10_000, max: 900_000 });
}

export function dataForSeoMapsEnabled(): boolean {
  return envBool("DATAFORSEO_MAPS_ENABLED", true);
}

export function dataForSeoMapsConcurrency(): number {
  return envInt("DATAFORSEO_MAPS_CONCURRENCY", 8, { min: 1, max: 100 });
}

export function dataForSeoMapsMaxTasksPerPost(): number {
  return envInt("DATAFORSEO_MAPS_MAX_TASKS_PER_POST", 100, { min: 1, max: 100 });
}

/**
 * Application fairness chunk — cells reserved per scan before packing into a
 * DataForSEO POST (up to 100). Lets the scheduler round-robin across maps.
 */
export function dataForSeoMapsAppChunkSize(): number {
  return envInt("DATAFORSEO_MAPS_APP_CHUNK_SIZE", 25, { min: 1, max: 100 });
}

/** Min delay between successive DataForSEO task_post calls (smooth traffic). */
export function dataForSeoMapsPostDelayMinMs(): number {
  return envInt("DATAFORSEO_MAPS_POST_DELAY_MIN_MS", 50, { min: 0, max: 5_000 });
}

/** Max delay between successive DataForSEO task_post calls. */
export function dataForSeoMapsPostDelayMaxMs(): number {
  const min = dataForSeoMapsPostDelayMinMs();
  const max = envInt("DATAFORSEO_MAPS_POST_DELAY_MAX_MS", 100, { min: 0, max: 5_000 });
  return Math.max(min, max);
}

/** Cap parallel task_get GETs per poll tick (avoids stampeding DFS). */
export function dataForSeoMapsPollGetConcurrency(): number {
  return envInt("DATAFORSEO_MAPS_POLL_GET_CONCURRENCY", 50, { min: 1, max: 200 });
}

/** Outer adapter timeout for Priority post+poll (Priority ~1 min avg). */
export function dataForSeoMapsTimeoutMs(): number {
  return envInt("DATAFORSEO_MAPS_TIMEOUT_MS", 180_000, { min: 30_000, max: 600_000 });
}

/**
 * Hard ceiling for unfinished-cell DataForSEO recovery
 * (primary + jittered Priority retries until done — same idea as Bright Data).
 */
export function dataForSeoRecoveryDeadlineMs(): number {
  return envInt("DATAFORSEO_RECOVERY_DEADLINE_MS", 10 * 60_000, {
    min: 60_000,
    max: 45 * 60_000,
  });
}

/** Min wait between unfinished-cell DataForSEO Priority retry rounds. */
export function dataForSeoRetryDelayMinMs(): number {
  return envInt("DATAFORSEO_RETRY_DELAY_MIN_MS", 8_000, { min: 0, max: 120_000 });
}

/** Max wait between unfinished-cell DataForSEO Priority retry rounds. */
export function dataForSeoRetryDelayMaxMs(): number {
  return envInt("DATAFORSEO_RETRY_DELAY_MAX_MS", 15_000, { min: 0, max: 180_000 });
}

/** Jittered delay before the next unfinished-cell DFS retry round. */
export function dataForSeoRetryDelayMs(): number {
  return jitterMs(dataForSeoRetryDelayMinMs(), dataForSeoRetryDelayMaxMs());
}

/** Max Priority recovery rounds inside the deadline (deadline is the real stop). */
export function dataForSeoRetryMaxRounds(): number {
  return envInt("DATAFORSEO_RETRY_MAX_ROUNDS", 40, { min: 1, max: 120 });
}

export function scrapingDogMapsEnabled(): boolean {
  return envBool("SCRAPINGDOG_MAPS_ENABLED", true);
}

export function scrapingDogMapsConcurrency(): number {
  return envInt("SCRAPINGDOG_MAPS_CONCURRENCY", 5, { min: 1, max: 100 });
}

export function scrapingDogMapsTimeoutMs(): number {
  return envInt("SCRAPINGDOG_MAPS_TIMEOUT_MS", 45_000, { min: 5_000, max: 180_000 });
}

export function maxTotalProviderAttemptsPerCell(): number {
  return envInt("MAX_TOTAL_PROVIDER_ATTEMPTS_PER_CELL", 6, { min: 1, max: 20 });
}

export function mapsFallbackEnabled(): boolean {
  return envBool("MAPS_GRID_FALLBACK_ENABLED", true);
}

export function hasDataForSeoCredentials(): boolean {
  return Boolean(process.env.DATAFORSEO_USERNAME?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

export function hasScrapingDogCredentials(): boolean {
  return Boolean(
    process.env.SCRAPINGDOG_API_KEY?.trim() || process.env.SCRAPING_DOG_API_KEY?.trim()
  );
}

export function hasBrightDataCredentials(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_KEY?.trim());
}

export function jitterMs(minMs: number, maxMs: number): number {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  if (hi <= 0) return 0;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export type BrightDataRecoveryRound = {
  /** 1-based round id for logs / UI */
  round: number;
  delayMinMs: number;
  delayMaxMs: number;
  concurrency: number;
};

/**
 * Template rounds for unfinished-cell Bright Data recovery.
 * Runtime loops these with 8–15s jitter until the deadline — not long multi-minute gaps.
 */
export function brightDataRecoverySchedule(): BrightDataRecoveryRound[] {
  const wave = brightDataGlobalConcurrency();
  const delayMin = brightDataRetryDelayMinMs();
  const delayMax = brightDataRetryDelayMaxMs();
  // Enough slots that a 10-minute deadline is the real stop, not round count.
  const slots = envInt("BRIGHTDATA_RETRY_MAX_ROUNDS", 40, { min: 1, max: 120 });
  return Array.from({ length: slots }, (_, i) => ({
    round: i + 1,
    delayMinMs: delayMin,
    delayMaxMs: delayMax,
    concurrency: envInt("BRIGHTDATA_RETRY_CONCURRENCY", wave, { min: 1, max: 250 }),
  }));
}

/** Escalating open durations: 30s → 60s → 120s → 240s → max. */
export function brightDataCircuitOpenDurationMs(openStreak: number): number {
  const base = brightDataCircuitOpenBaseMs();
  const max = brightDataCircuitOpenMaxMs();
  const streak = Math.max(0, Math.floor(openStreak));
  const ms = base * 2 ** streak;
  return Math.min(max, ms);
}
