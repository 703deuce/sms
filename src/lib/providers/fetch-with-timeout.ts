/**
 * Shared HTTP + circuit-breaker helpers for external providers.
 */

export class ProviderTimeoutError extends Error {
  readonly provider: string;
  readonly timeoutMs: number;

  constructor(provider: string, timeoutMs: number, label?: string) {
    super(
      label
        ? `${provider} timeout after ${timeoutMs}ms (${label})`
        : `${provider} timeout after ${timeoutMs}ms`
    );
    this.name = "ProviderTimeoutError";
    this.provider = provider;
    this.timeoutMs = timeoutMs;
  }
}

export class ProviderCircuitOpenError extends Error {
  readonly provider: string;
  readonly retryAfterMs: number;

  constructor(provider: string, retryAfterMs: number) {
    super(`${provider} circuit open — retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "ProviderCircuitOpenError";
    this.provider = provider;
    this.retryAfterMs = retryAfterMs;
  }
}

type CircuitState = {
  failures: number;
  openUntil: number;
};

const circuits = new Map<string, CircuitState>();

function circuitThreshold(provider: string): number {
  const n = Number(process.env[`PROVIDER_CIRCUIT_THRESHOLD_${provider.toUpperCase()}`]
    ?? process.env.PROVIDER_CIRCUIT_THRESHOLD
    ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function circuitCooldownMs(provider: string): number {
  const n = Number(process.env[`PROVIDER_CIRCUIT_COOLDOWN_MS_${provider.toUpperCase()}`]
    ?? process.env.PROVIDER_CIRCUIT_COOLDOWN_MS
    ?? 60_000);
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

/** Bright Data uses its own unfinished-cell retry schedule — never trip HTTP circuit. */
function circuitDisabledForProvider(provider: string): boolean {
  return /^brightdata/i.test(provider.trim());
}

export function assertCircuitClosed(provider: string): void {
  if (circuitDisabledForProvider(provider)) return;
  const state = circuits.get(provider);
  if (!state) return;
  const now = Date.now();
  if (state.openUntil > now) {
    throw new ProviderCircuitOpenError(provider, state.openUntil - now);
  }
  // Half-open: allow one attempt after cooldown.
  if (state.openUntil > 0) {
    state.openUntil = 0;
    state.failures = 0;
  }
}

export function recordProviderSuccess(provider: string): void {
  circuits.delete(provider);
}

export function recordProviderFailure(provider: string, err?: unknown): void {
  if (circuitDisabledForProvider(provider)) return;
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status?: number }).status)
      : undefined;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? "").toLowerCase();
  const retryable =
    err instanceof ProviderTimeoutError ||
    status === 429 ||
    (status != null && status >= 500) ||
    msg.includes("429") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("rate");

  if (!retryable && status != null && status < 500 && status !== 429) {
    return;
  }

  const state = circuits.get(provider) ?? { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= circuitThreshold(provider)) {
    state.openUntil = Date.now() + circuitCooldownMs(provider);
    console.warn(`[Circuit] ${provider} opened for ${circuitCooldownMs(provider)}ms after ${state.failures} failures`);
  }
  circuits.set(provider, state);
}

/** Default timeouts per provider family (overridable via PROVIDER_TIMEOUT_MS_*). */
export function providerTimeoutMs(provider: string, fallback = 45_000): number {
  const key = `PROVIDER_TIMEOUT_MS_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const n = Number(process.env[key] ?? process.env.PROVIDER_TIMEOUT_MS ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type FetchUsageContext = {
  organizationId?: string | null;
  businessId?: string | null;
  jobId?: string | null;
  feature?: string;
  unitType?: string;
  estimatedCostUsd?: number | null;
  actualUnits?: number | null;
  idempotencyKey?: string | null;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  opts: {
    provider: string;
    timeoutMs: number;
    label?: string;
    skipCircuit?: boolean;
    usage?: FetchUsageContext;
  }
): Promise<Response> {
  if (!opts.skipCircuit) {
    assertCircuitClosed(opts.provider);
  }

  const controller = new AbortController();
  const parentSignal = init?.signal;
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener("abort", () => controller.abort(parentSignal.reason), {
        once: true,
      });
    }
  }

  const timer = setTimeout(() => {
    controller.abort(new ProviderTimeoutError(opts.provider, opts.timeoutMs, opts.label));
  }, opts.timeoutMs);

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    if (res.status === 429 || res.status >= 500) {
      recordProviderFailure(opts.provider, { status: res.status });
    } else if (res.ok) {
      recordProviderSuccess(opts.provider);
      if (opts.usage?.organizationId) {
        // Import ledger directly — avoid fetch-with-timeout ↔ gateway cycle.
        const { recordUsage } = await import("@/lib/platform/usage-ledger");
        void recordUsage({
          organizationId: opts.usage.organizationId,
          businessId: opts.usage.businessId,
          jobId: opts.usage.jobId,
          feature: opts.usage.feature ?? opts.label ?? opts.provider,
          provider: opts.provider,
          unitType: opts.usage.unitType ?? "request",
          estimatedCostUsd: opts.usage.estimatedCostUsd ?? estimateProviderCost(opts.provider),
          actualUnits: opts.usage.actualUnits ?? 1,
          idempotencyKey: opts.usage.idempotencyKey ?? null,
        });
      }
    }
    return res;
  } catch (err) {
    if (err instanceof ProviderTimeoutError) {
      recordProviderFailure(opts.provider, err);
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      const timeout = new ProviderTimeoutError(opts.provider, opts.timeoutMs, opts.label);
      recordProviderFailure(opts.provider, timeout);
      throw timeout;
    }
    recordProviderFailure(opts.provider, err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Rough cost markers for provider_runs.cost_estimate (USD). Env-overridable. */
export function estimateProviderCost(provider: string, units = 1): number | undefined {
  const envKey = `PROVIDER_COST_USD_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const unit = Number(process.env[envKey]);
  if (Number.isFinite(unit) && unit >= 0) return unit * units;
  const defaults: Record<string, number> = {
    brightdata: 0.0015,
    scrapingdog: 0.001,
    dataforseo: 0.002,
    deepseek: 0.0002,
    gemini: 0.0003,
    kimi: 0.0003,
    claude: 0.003,
    cloro: 0.002,
  };
  const base = defaults[provider];
  return base != null ? base * units : undefined;
}
