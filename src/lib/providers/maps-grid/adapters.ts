import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { minCellSerpResults } from "@/lib/maps/cell-result-integrity";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { mapsGridCell as brightDataMapsGridCell } from "@/lib/providers/brightdata/maps-grid";
import { BrightDataMapsFailure } from "@/lib/providers/brightdata/failure-diagnostics";
import { mapsLiveGridCell } from "@/lib/providers/dataforseo";
import { mapsGridCell as scrapingDogMapsGridCell } from "@/lib/providers/scrapingdog/maps-grid";
import { acquireMapsProviderSlot } from "@/lib/queue/maps-provider-limiter";
import {
  brightDataNormalCellTimeoutMs,
  dataForSeoMapsTimeoutMs,
  hasBrightDataCredentials,
  hasDataForSeoCredentials,
  hasScrapingDogCredentials,
  scrapingDogMapsTimeoutMs,
} from "@/lib/providers/maps-grid/config";
import {
  classifyErrorMessage,
  fromBrightDataCategory,
  type MapsFailureCategory,
} from "@/lib/providers/maps-grid/failure-categories";
import type { MapsProviderAttempt, MapsProviderId } from "@/lib/providers/maps-grid/types";
import type { MapsLiveResult } from "@/lib/providers/dataforseo";

export type AdapterInput = {
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth: number;
  locationZoom?: number;
  organizationId?: string;
  attemptNumber: number;
  timeoutMs?: number;
};

export type AdapterSuccess = {
  ok: true;
  items: MapsLiveResult[];
  request: Record<string, unknown>;
  timestamp: string;
  attempt: MapsProviderAttempt;
};

export type AdapterFailure = {
  ok: false;
  attempt: MapsProviderAttempt;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function providerAvailable(provider: MapsProviderId): { ok: true } | { ok: false; category: MapsFailureCategory; message: string } {
  if (provider === "brightdata" && !hasBrightDataCredentials()) {
    return { ok: false, category: "provider_unavailable", message: "Bright Data credentials not configured" };
  }
  if (provider === "dataforseo" && !hasDataForSeoCredentials()) {
    return { ok: false, category: "provider_unavailable", message: "DataForSEO credentials not configured" };
  }
  if (provider === "scrapingdog" && !hasScrapingDogCredentials()) {
    return { ok: false, category: "provider_unavailable", message: "ScrapingDog credentials not configured" };
  }
  return { ok: true };
}

function categorizeCaught(err: unknown): { category: MapsFailureCategory; message: string; httpStatus?: number | null; diagnostics?: Record<string, unknown> } {
  if (err instanceof BrightDataMapsFailure) {
    let category = fromBrightDataCategory(err.category);
    const status = err.diagnostics.httpStatus;
    // Cookie-pool misses are capacity, not a real Maps attempt — keep as capacity_timeout.
    const code = String(err.diagnostics.providerErrorCode ?? "").toLowerCase();
    const msg = String(err.diagnostics.providerErrorMessage ?? err.message ?? "").toLowerCase();
    if (
      err.category === "capacity_timeout" ||
      code.includes("no_ready_cookies") ||
      msg.includes("no_ready_cookies") ||
      msg.includes("no ready cookies")
    ) {
      category = "capacity_timeout";
    } else if (status === 429) category = "http_429";
    else if (status === 502) category = "http_502";
    else if (status === 503) category = "http_503";
    else if (status === 504) category = "http_504";
    else if (err.category === "empty_maps_results") {
      // Valid empty organic collection vs empty/unparseable body.
      const keys = err.diagnostics.schemaKeys ?? [];
      const hasOrganicKey = keys.includes("organic");
      const byteCount = err.diagnostics.byteCount ?? 0;
      category =
        hasOrganicKey && byteCount > 2 ? "valid_empty_maps_results" : "empty_body";
    } else if (err.diagnostics.markers?.unusualTraffic) {
      category = "google_unusual_traffic";
    }
    return {
      category,
      message: err.message,
      httpStatus: status ?? null,
      diagnostics: err.diagnostics as unknown as Record<string, unknown>,
    };
  }
  const message = err instanceof Error ? err.message : String(err ?? "unknown");
  return { category: classifyErrorMessage(message), message };
}

export async function runMapsProviderAdapter(
  provider: MapsProviderId,
  input: AdapterInput
): Promise<AdapterSuccess | AdapterFailure> {
  const availability = providerAvailable(provider);
  if (!availability.ok) {
    return {
      ok: false,
      attempt: {
        provider,
        attemptNumber: input.attemptNumber,
        success: false,
        category: availability.category,
        latencyMs: 0,
        errorMessage: availability.message,
      },
    };
  }

  const timeoutMs =
    input.timeoutMs ??
    (provider === "brightdata"
      ? brightDataNormalCellTimeoutMs()
      : provider === "dataforseo"
        ? dataForSeoMapsTimeoutMs()
        : scrapingDogMapsTimeoutMs());

  const started = Date.now();
  let slot: { release: () => Promise<void> } | null = null;
  try {
    slot = await acquireMapsProviderSlot(provider, timeoutMs + 15_000);
    let items: MapsLiveResult[] = [];
    let request: Record<string, unknown> = {};
    let timestamp = new Date().toISOString();

    const zoom = input.locationZoom ?? LOCAL_FALCON_PARITY.locationZoom;

    if (provider === "brightdata") {
      const live = await withTimeout(
        brightDataMapsGridCell({
          keyword: input.keyword,
          lat: input.lat,
          lng: input.lng,
          device: input.device,
          os: input.os,
          browser: input.browser,
          depth: input.depth,
          zoom,
          organizationId: input.organizationId,
        }),
        timeoutMs,
        "brightdata"
      );
      items = live.items;
      request = live.request as unknown as Record<string, unknown>;
      timestamp = live.timestamp;
    } else if (provider === "dataforseo") {
      const live = await withTimeout(
        mapsLiveGridCell({
          keyword: input.keyword,
          lat: input.lat,
          lng: input.lng,
          device: input.device,
          os: input.os,
          browser: input.browser,
          depth: input.depth,
          zoom,
          organizationId: input.organizationId,
          languageCode: LOCAL_FALCON_PARITY.languageCode,
        }),
        timeoutMs,
        "dataforseo"
      );
      items = live.items;
      request = live.request as unknown as Record<string, unknown>;
      timestamp = live.timestamp ?? timestamp;
    } else {
      const live = await withTimeout(
        scrapingDogMapsGridCell({
          keyword: input.keyword,
          lat: input.lat,
          lng: input.lng,
          device: input.device,
          os: input.os,
          browser: input.browser,
          depth: input.depth,
          zoom,
          organizationId: input.organizationId,
        }),
        timeoutMs,
        "scrapingdog"
      );
      items = live.items;
      request = live.request as unknown as Record<string, unknown>;
      timestamp = live.timestamp;
    }

    const latencyMs = Date.now() - started;
    if (!items.length) {
      return {
        ok: false,
        attempt: {
          provider,
          attemptNumber: input.attemptNumber,
          success: false,
          category: "valid_empty_maps_results",
          latencyMs,
          errorMessage: `${provider} returned a valid empty Maps result collection`,
        },
      };
    }

    // Accept packs at the shared min floor (default 10). Still request depth 20.
    const minSerp = minCellSerpResults(input.depth);
    if (items.length < minSerp) {
      return {
        ok: false,
        attempt: {
          provider,
          attemptNumber: input.attemptNumber,
          success: false,
          category: "sparse_maps_results",
          latencyMs,
          errorMessage:
            items.length === 1
              ? `target-only SERP: only 1 listing returned (need ${minSerp})`
              : `sparse SERP: ${items.length} results returned (need ${minSerp})`,
        },
      };
    }

    return {
      ok: true,
      items,
      request,
      timestamp,
      attempt: {
        provider,
        attemptNumber: input.attemptNumber,
        success: true,
        category: "success",
        latencyMs,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const classified = categorizeCaught(err);
    return {
      ok: false,
      attempt: {
        provider,
        attemptNumber: input.attemptNumber,
        success: false,
        category: classified.category,
        latencyMs,
        httpStatus: classified.httpStatus ?? null,
        errorMessage: classified.message,
        diagnostics: classified.diagnostics ?? null,
      },
    };
  } finally {
    await slot?.release();
  }
}
