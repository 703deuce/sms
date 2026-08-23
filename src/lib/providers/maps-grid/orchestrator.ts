/**
 * Cell-level Maps provider orchestrator.
 * Provider sequence is supplied by the caller (batch recovery decides BD vs fallback).
 */

import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { validateLiveCellSerp } from "@/lib/maps/cell-result-integrity";
import type { TargetMatchInput } from "@/lib/providers/dataforseo/match-target";
import { runMapsProviderAdapter } from "@/lib/providers/maps-grid/adapters";
import {
  dataForSeoMapsEnabled,
  hasDataForSeoCredentials,
  hasScrapingDogCredentials,
  mapsFallbackEnabled,
  maxTotalProviderAttemptsPerCell,
  scrapingDogMapsEnabled,
} from "@/lib/providers/maps-grid/config";
import {
  isPermanentMapsFailure,
  isTransientMapsFailure,
  type MapsFailureCategory,
} from "@/lib/providers/maps-grid/failure-categories";
import type {
  MapsCellFetchResult,
  MapsProviderAttempt,
  MapsProviderId,
} from "@/lib/providers/maps-grid/types";

export type FetchMapsCellParams = {
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth: number;
  /** Maps SERP zoom (Local Falcon API default 13). */
  locationZoom?: number;
  organizationId?: string;
  /** Explicit provider chain for this call. */
  providers: MapsProviderId[];
  /** Allow one transient retry on the last/current provider before moving on. */
  allowTransientRetry?: boolean;
  /**
   * When set, a provider response must pass SERP completeness before it wins.
   * Sparse / empty-organic results continue to the next provider instead of
   * short-circuiting the fallback chain.
   */
  target?: TargetMatchInput;
  gridLabel?: string;
};

export type MapsProviderSkipReason =
  | "fallback_disabled"
  | "provider_disabled"
  | "missing_credentials"
  | "circuit_open";

export type MapsProviderAvailability = {
  provider: MapsProviderId;
  enabled: boolean;
  skipReason?: MapsProviderSkipReason;
  detail?: string;
};

/**
 * @param role - `primary` ignores MAPS_GRID_FALLBACK_ENABLED (that flag only
 *   gates secondary/fallback providers). Selecting DataForSEO as the scan mode
 *   must not be blocked just because fallbacks are off.
 */
export function describeMapsProviderAvailability(
  provider: MapsProviderId,
  options?: { role?: "primary" | "secondary" }
): MapsProviderAvailability {
  const role = options?.role ?? "primary";

  if (provider === "brightdata") {
    return { provider, enabled: true };
  }

  // Fallback gate applies only to secondary providers in a multi-provider chain.
  if (role === "secondary" && !mapsFallbackEnabled()) {
    return {
      provider,
      enabled: false,
      skipReason: "fallback_disabled",
      detail: "MAPS_GRID_FALLBACK_ENABLED is false",
    };
  }

  if (provider === "dataforseo") {
    if (!dataForSeoMapsEnabled()) {
      return {
        provider,
        enabled: false,
        skipReason: "provider_disabled",
        detail: "DATAFORSEO_MAPS_ENABLED is false",
      };
    }
    if (!hasDataForSeoCredentials()) {
      return {
        provider,
        enabled: false,
        skipReason: "missing_credentials",
        detail:
          "DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD missing on this process (maps worker needs them)",
      };
    }
    return { provider, enabled: true };
  }
  if (provider === "scrapingdog") {
    if (!scrapingDogMapsEnabled()) {
      return {
        provider,
        enabled: false,
        skipReason: "provider_disabled",
        detail: "SCRAPINGDOG_MAPS_ENABLED is false",
      };
    }
    if (!hasScrapingDogCredentials()) {
      return {
        provider,
        enabled: false,
        skipReason: "missing_credentials",
        detail:
          "SCRAPINGDOG_API_KEY missing on this process (maps worker needs it)",
      };
    }
    return { provider, enabled: true };
  }
  return { provider, enabled: false, skipReason: "provider_disabled", detail: "unknown provider" };
}

/** Resolve which of the requested providers can actually run right now. */
export async function resolveUsableMapsProviders(
  providers: MapsProviderId[]
): Promise<{
  usable: MapsProviderId[];
  skipped: MapsProviderAvailability[];
}> {
  const skipped: MapsProviderAvailability[] = [];
  const usable: MapsProviderId[] = [];
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i]!;
    const availability = describeMapsProviderAvailability(p, {
      role: i === 0 ? "primary" : "secondary",
    });
    if (!availability.enabled) {
      skipped.push(availability);
      continue;
    }
    usable.push(p);
  }
  return { usable, skipped };
}

export function logMapsProviderAvailability(context: string): void {
  for (const provider of ["brightdata", "dataforseo", "scrapingdog"] as MapsProviderId[]) {
    const a = describeMapsProviderAvailability(provider);
    if (a.enabled) {
      console.log(`[MapsProviders] ${context} ${provider}=ready`);
    } else {
      console.warn(
        `[MapsProviders] ${context} ${provider}=SKIPPED reason=${a.skipReason} detail=${a.detail ?? ""}`
      );
    }
  }
}

/**
 * Fetch a single grid cell through the supplied provider sequence.
 * Never overwrites success — returns on first valid item list.
 *
 * Walks the caller-supplied provider list in order. Providers that are disabled /
 * missing credentials / circuit-open still emit a failed attempt so scans cannot
 * "finish after Bright Data" with zero secondary attempt records.
 */
export async function fetchMapsCell(params: FetchMapsCellParams): Promise<MapsCellFetchResult> {
  const resolved = await resolveUsableMapsProviders(params.providers);
  const usable = new Set(resolved.usable);
  const skippedByProvider = new Map(
    resolved.skipped.map((s) => [s.provider, s] as const)
  );
  const providers = params.providers;
  const attempts: MapsProviderAttempt[] = [];
  const maxAttempts = maxTotalProviderAttemptsPerCell();
  let attemptBudget = 0;
  const primaryProvider: MapsProviderId = params.providers[0] ?? "dataforseo";
  let fallbackReason: string | null = null;

  if (!providers.length) {
    return {
      ok: false,
      unresolvedReason: "provider_unresolved",
      primaryProvider,
      finalProvider: null,
      fallbackUsed: false,
      fallbackReason: "no_providers_requested",
      attempts,
      lastCategory: "provider_unavailable",
      lastErrorMessage: "No Maps providers requested for this cell",
      providerLatencyMs: 0,
    };
  }

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    if (i > 0) {
      fallbackReason = fallbackReason ?? `fallback_after_${attempts[attempts.length - 1]?.category ?? "failure"}`;
    }

    if (!usable.has(provider)) {
      const skipped = skippedByProvider.get(provider);
      const detail =
        skipped?.detail ??
        skipped?.skipReason ??
        "provider unavailable";
      console.warn(
        `[MapsFallback] grid=${params.gridLabel ?? "?"} provider=${provider} SKIPPED reason=${skipped?.skipReason ?? "unavailable"} detail=${detail}`
      );
      attempts.push({
        provider,
        attemptNumber: 1,
        success: false,
        category: "provider_unavailable",
        latencyMs: 0,
        errorMessage: detail,
      });
      continue;
    }

    const maxTries =
      params.allowTransientRetry !== false && (provider === "dataforseo" || provider === "scrapingdog")
        ? 2
        : 1;

    for (let tryNum = 1; tryNum <= maxTries; tryNum++) {
      if (attemptBudget >= maxAttempts) break;
      attemptBudget += 1;

      if (tryNum > 1) {
        const delay =
          provider === "scrapingdog"
            ? 5_000 + Math.floor(Math.random() * 7_000)
            : 5_000 + Math.floor(Math.random() * 5_000);
        await new Promise((r) => setTimeout(r, delay));
      }

      console.log(
        `[MapsFallback] grid=${params.gridLabel ?? "?"} provider=${provider} attempt=${tryNum} starting`
      );
      const result = await runMapsProviderAdapter(provider, {
        keyword: params.keyword,
        lat: params.lat,
        lng: params.lng,
        device: params.device,
        os: params.os,
        browser: params.browser,
        depth: params.depth,
        locationZoom: params.locationZoom,
        organizationId: params.organizationId,
        attemptNumber: tryNum,
      });

      if (result.ok && params.target) {
        const serp = validateLiveCellSerp(result.items, params.target, params.depth);
        if (!serp.complete) {
          const category = (serp.category ?? "sparse_maps_results") as MapsFailureCategory;
          console.warn(
            `[MapsFallback] grid=${params.gridLabel ?? "?"} provider=${provider} incomplete SERP (${serp.reason}) — trying next provider`
          );
          attempts.push({
            ...result.attempt,
            success: false,
            category,
            errorMessage: serp.reason ?? "Incomplete map results for this cell",
          });
          // Treat incomplete SERP as transient so secondary providers still run.
          if (tryNum < maxTries) continue;
          break;
        }
      }

      attempts.push(result.attempt);

      if (result.ok) {
        console.log(
          `[MapsFallback] grid=${params.gridLabel ?? "?"} provider=${provider} SUCCESS items=${result.items.length}`
        );
        return {
          ok: true,
          items: result.items,
          request: {
            ...result.request,
            _provenance: {
              primary_provider: primaryProvider,
              final_provider: provider,
              fallback_used: provider !== primaryProvider || i > 0,
              fallback_reason: fallbackReason,
              provider_attempts: attempts,
            },
          },
          timestamp: result.timestamp,
          primaryProvider,
          finalProvider: provider,
          fallbackUsed: i > 0 || provider !== primaryProvider,
          fallbackReason,
          attempts,
          providerLatencyMs: result.attempt.latencyMs,
        };
      }

      console.warn(
        `[MapsFallback] grid=${params.gridLabel ?? "?"} provider=${provider} FAILED category=${result.attempt.category}: ${result.attempt.errorMessage ?? ""}`
      );

      if (isPermanentMapsFailure(result.attempt.category)) {
        break; // next provider
      }
      if (tryNum < maxTries && isTransientMapsFailure(result.attempt.category)) {
        continue;
      }
      break;
    }
  }

  const last = attempts[attempts.length - 1];
  const skipOnly =
    attempts.length > 0 && attempts.every((a) => a.category === "provider_unavailable");
  return {
    ok: false,
    unresolvedReason: "provider_unresolved",
    primaryProvider,
    finalProvider: last?.provider ?? null,
    fallbackUsed: attempts.some((a) => a.provider !== primaryProvider),
    fallbackReason: fallbackReason ?? last?.category ?? "all_providers_failed",
    attempts,
    lastCategory: last?.category ?? "unknown",
    lastErrorMessage: skipOnly
      ? `No Maps providers available for this cell (${attempts
          .map((a) => `${a.provider}:${a.errorMessage ?? "unavailable"}`)
          .join(", ")})`
      : (last?.errorMessage ?? "All Maps providers failed for this cell"),
    providerLatencyMs: attempts.reduce((s, a) => s + a.latencyMs, 0),
  };
}

/** Bright Data only (primary / recovery / probe). */
export function brightDataOnlyProviders(): MapsProviderId[] {
  return ["brightdata"];
}

/** Secondary fallbacks after the primary provider is exhausted. */
export function secondaryFallbackProviders(): MapsProviderId[] {
  // Ops helper only — standard DataForSEO mode has no secondary chain.
  return ["brightdata"];
}

/** Full chain when a cell should try everything remaining. */
export function fullFallbackProviders(): MapsProviderId[] {
  return ["brightdata", "dataforseo", "scrapingdog"];
}
