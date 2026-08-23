import { createServiceClient } from "@/lib/db/client";
import { hashRequest } from "@/lib/utils";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { buildBrightDataMapsUrl } from "@/lib/providers/brightdata/url";
import {
  BrightDataMapsFailure,
  classifyBrightDataMapsResponse,
  diagnosticsForStorage,
  extractBrightDataErrorHeaders,
  extractBrightDataRequestId,
  humanMessageForCategory,
  logBrightDataFailureDiagnostics,
  redactProviderText,
} from "@/lib/providers/brightdata/failure-diagnostics";
import {
  estimateProviderCost,
  fetchWithTimeout,
  providerTimeoutMs,
  ProviderTimeoutError,
} from "@/lib/providers/fetch-with-timeout";

function getApiKey(): string {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new Error("BRIGHTDATA_API_KEY is required");
  return key;
}

async function resolveBrightDataZone(): Promise<string> {
  const fromEnv = process.env.BRIGHTDATA_ZONE ?? process.env.BRIGHTDATA_SERP_ZONE;
  if (fromEnv?.trim()) return fromEnv.trim();

  const res = await fetchWithTimeout(
    "https://api.brightdata.com/zone/get_active_zones",
    { headers: { Authorization: `Bearer ${getApiKey()}` } },
    { provider: "brightdata", timeoutMs: providerTimeoutMs("brightdata", 15_000), label: "zones" }
  );
  if (res.ok) {
    const zones = (await res.json()) as Array<{ name?: string; type?: string }>;
    const serp = zones.find((z) => /serp|unlocker/i.test(z.type ?? "") || /serp/i.test(z.name ?? ""));
    if (serp?.name) return serp.name;
    if (zones[0]?.name) return zones[0].name;
  }

  throw new Error(
    "BRIGHTDATA_ZONE is required — create a SERP API zone at https://brightdata.com/cp/zones (residential proxy returns HTML, not ranked Maps JSON)"
  );
}

export type BrightDataOrganicItem = {
  global_rank?: number;
  rank?: number;
  title?: string;
  address?: string;
  phone?: string;
  link?: string;
  map_link?: string;
  map_id?: string;
  map_id_encoded?: string;
  fid?: string;
  rating?: number;
  reviews_cnt?: number;
  latitude?: number;
  longitude?: number;
  category?: Array<{ id?: string; title?: string; title_short?: string }>;
};

type BrightDataMapsResponse = {
  organic?: BrightDataOrganicItem[];
  place?: BrightDataOrganicItem;
  body?: string | BrightDataMapsResponse;
};

async function logBrightDataRun(params: {
  organizationId?: string;
  endpoint: string;
  request: Record<string, unknown>;
  response: unknown;
  statusCode: number;
  latencyMs: number;
  costEstimate?: number;
}): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const requestHash = await hashRequest(params.request);
    await supabase.from("provider_runs").insert({
      organization_id: params.organizationId ?? null,
      provider: "brightdata",
      endpoint: params.endpoint,
      request_hash: requestHash,
      status_code: params.statusCode,
      latency_ms: params.latencyMs,
      cost_estimate: params.costEstimate ?? null,
      raw_request_json: params.request,
      raw_response_json: params.response as Record<string, unknown>,
    });
    return requestHash;
  } catch {
    return null;
  }
}

function parseBrightDataBody(text: string): BrightDataOrganicItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  const unwrap = (payload: unknown): BrightDataOrganicItem[] => {
    if (!payload || typeof payload !== "object") return [];
    const o = payload as BrightDataMapsResponse;
    if (Array.isArray(o.organic) && o.organic.length) return o.organic;
    if (o.place) return [o.place];
    if (typeof o.body === "string") {
      try {
        return unwrap(JSON.parse(o.body));
      } catch {
        return [];
      }
    }
    if (o.body && typeof o.body === "object") return unwrap(o.body);
    return [];
  };

  if (Array.isArray(data)) return data as BrightDataOrganicItem[];
  return unwrap(data);
}

/** Bright Data SERP API — Google Maps search at lat/lng (Local Falcon parity) */
export async function mapsSearchAtCoordinate(params: {
  keyword: string;
  lat: number;
  lng: number;
  zoom?: number;
  device?: ScanDeviceProfile["device"];
  os?: ScanDeviceProfile["os"];
  browser?: ScanDeviceProfile["browser"];
  organizationId?: string;
}): Promise<BrightDataOrganicItem[]> {
  const start = Date.now();
  const zone = process.env.BRIGHTDATA_ZONE?.trim() || (await resolveBrightDataZone());
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const url = buildBrightDataMapsUrl({
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    zoom,
    device: params.device,
    os: params.os,
    browser: params.browser,
  });
  const requestBody = {
    zone,
    url,
    format: "raw" as const,
    data_format: "parsed_light" as const,
  };

  const requestForLog = {
    ...requestBody,
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    zoom,
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(
      "https://api.brightdata.com/request",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      {
        provider: "brightdata",
        timeoutMs: providerTimeoutMs("brightdata", 45_000),
        label: "mapsSearchAtCoordinate",
      }
    );
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof ProviderTimeoutError) {
      const failure = new BrightDataMapsFailure(
        {
          category: "provider_timeout",
          latencyMs,
          zone,
          providerErrorMessage: err.message,
        },
        err.message
      );
      logBrightDataFailureDiagnostics("mapsSearchAtCoordinate", failure.diagnostics);
      await logBrightDataRun({
        organizationId: params.organizationId,
        endpoint: "request",
        request: requestForLog,
        response: diagnosticsForStorage(failure.diagnostics),
        statusCode: 0,
        latencyMs,
      });
      throw failure;
    }
    throw err;
  }

  const text = await res.text();
  const latencyMs = Date.now() - start;
  const requestId = extractBrightDataRequestId(res.headers);
  const responseHeaders = extractBrightDataErrorHeaders(res.headers);
  const contentType = res.headers.get("content-type");
  const items = res.ok ? parseBrightDataBody(text) : [];
  const costEstimate = estimateProviderCost("brightdata");

  if (!res.ok || !items.length) {
    const diagnostics = classifyBrightDataMapsResponse({
      httpStatus: res.status,
      contentType,
      bodyText: text,
      latencyMs,
      zone,
      requestId,
      organicCount: items.length,
      responseHeaders,
    });
    const failure = new BrightDataMapsFailure(
      diagnostics,
      humanMessageForCategory(diagnostics.category, {
        status: res.status,
        detail: diagnostics.providerErrorMessage ?? undefined,
        zone,
        organicCount: items.length,
      })
    );
    logBrightDataFailureDiagnostics("mapsSearchAtCoordinate", failure.diagnostics);
    // Store redacted diagnostics only — never dump full provider bodies on failure.
    await logBrightDataRun({
      organizationId: params.organizationId,
      endpoint: "request",
      request: requestForLog,
      response: diagnosticsForStorage(failure.diagnostics),
      statusCode: res.status,
      latencyMs,
      costEstimate,
    });
    throw failure;
  }

  // Success: keep a compact summary in provider_runs (titles/ids only, truncated).
  const successSummary = {
    organic_count: items.length,
    request_id: requestId,
    content_type: contentType,
    sample: items.slice(0, 3).map((item) => ({
      rank: item.global_rank ?? item.rank ?? null,
      title: item.title ? redactProviderText(String(item.title), 80) : null,
      map_id: item.map_id ?? null,
    })),
  };

  const requestHash = await logBrightDataRun({
    organizationId: params.organizationId,
    endpoint: "request",
    request: requestForLog,
    response: successSummary,
    statusCode: res.status,
    latencyMs,
    costEstimate,
  });

  // Usage is recorded by the caller after SERP validation + upsert so incomplete
  // responses that throw post-parse are not billed (retries would double-charge).
  void requestHash;
  void costEstimate;

  return items;
}

export {
  BrightDataMapsFailure,
  classifyBrightDataMapsResponse,
  diagnosticsForStorage,
  humanMessageForCategory,
} from "@/lib/providers/brightdata/failure-diagnostics";
export type {
  BrightDataFailureCategory,
  BrightDataFailureDiagnostics,
} from "@/lib/providers/brightdata/failure-diagnostics";

export {
  buildBrightDataMapsGridRequest,
  mapsGridCell,
  mapsGridDepth,
  normalizeBrightDataResults,
} from "@/lib/providers/brightdata/maps-grid";
export type { BrightDataMapsGridRequest } from "@/lib/providers/brightdata/maps-grid";
