import { logProviderRun } from "@/lib/providers/dataforseo";
import {
  estimateProviderCost,
  fetchWithTimeout,
  providerTimeoutMs,
} from "@/lib/providers/fetch-with-timeout";
import { parseISO, isValid, startOfDay, subDays } from "date-fns";

function getApiKey(): string {
  const key = process.env.SCRAPINGDOG_API_KEY ?? process.env.SCRAPING_DOG_API_KEY;
  if (!key) throw new Error("SCRAPINGDOG_API_KEY is required");
  return key;
}

export class ScrapingDogHttpError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly requestParams: Record<string, string>;
  readonly responseBody: unknown;

  constructor(params: {
    status: number;
    endpoint: string;
    requestParams: Record<string, string>;
    responseBody: unknown;
  }) {
    const detail = extractScrapingDogErrorMessage(params.responseBody);
    super(`ScrapingDog ${params.endpoint} HTTP ${params.status}${detail ? `: ${detail}` : ""}`);
    this.name = "ScrapingDogHttpError";
    this.status = params.status;
    this.endpoint = params.endpoint;
    this.requestParams = params.requestParams;
    this.responseBody = params.responseBody;
  }
}

function extractScrapingDogErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  for (const key of ["message", "error", "detail", "status_message", "msg"]) {
    if (typeof o[key] === "string" && o[key]) return o[key] as string;
  }
  if (typeof o.raw === "string" && o.raw) return o.raw.slice(0, 200);
  return null;
}

function logScrapingDogFailure(params: {
  endpoint: string;
  requestParams: Record<string, string>;
  status: number;
  responseBody: unknown;
  latencyMs: number;
}): void {
  const safeParams = { ...params.requestParams };
  console.error("[ScrapingDog] request_failed", {
    endpoint: params.endpoint,
    httpStatus: params.status,
    latencyMs: params.latencyMs,
    request: safeParams,
    responsePreview: summarizeResponse(params.responseBody),
    responseBody: params.responseBody,
  });
}

function summarizeResponse(body: unknown): string {
  if (body == null) return "(empty)";
  if (typeof body === "string") return body.slice(0, 300);
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body).slice(0, 300);
  }
}

function logScrapingDogSuccess(params: {
  endpoint: string;
  requestParams: Record<string, string>;
  status: number;
  latencyMs: number;
  itemHint?: string;
}): void {
  console.log("[ScrapingDog] request_ok", {
    endpoint: params.endpoint,
    httpStatus: params.status,
    latencyMs: params.latencyMs,
    request: params.requestParams,
    ...(params.itemHint ? { hint: params.itemHint } : {}),
  });
}

async function scrapingDogGet<T>(
  path: string,
  params: Record<string, string>,
  organizationId?: string
): Promise<T> {
  const start = Date.now();
  const url = new URL(`https://api.scrapingdog.com/${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchWithTimeout(
    url.toString(),
    undefined,
    {
      provider: "scrapingdog",
      timeoutMs: providerTimeoutMs("scrapingdog", 45_000),
      label: path,
    }
  );
  const latencyMs = Date.now() - start;
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  await logProviderRun({
    organizationId,
    provider: "scrapingdog",
    endpoint: path,
    request: params,
    response: data,
    statusCode: res.status,
    latencyMs,
    costEstimate: estimateProviderCost("scrapingdog"),
  });

  if (!res.ok) {
    logScrapingDogFailure({
      endpoint: path,
      requestParams: params,
      status: res.status,
      responseBody: data,
      latencyMs,
    });
    throw new ScrapingDogHttpError({
      status: res.status,
      endpoint: path,
      requestParams: params,
      responseBody: data,
    });
  }

  return data as T;
}

export interface MapsSearchResult {
  title?: string;
  place_id?: string;
  data_id?: string;
  rating?: number;
  reviews?: number;
  address?: string;
  phone?: string;
  website?: string;
  type?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
}

export async function mapsSearch(params: {
  query: string;
  organizationId?: string;
}): Promise<MapsSearchResult[]> {
  return mapsSearchAtCoordinate({
    query: params.query,
    organizationId: params.organizationId,
  });
}

/** Grid / coordinate-based Maps search — Local Falcon parity uses ll=@lat,lng,17z */
export async function mapsSearchAtCoordinate(params: {
  query: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  domain?: string;
  language?: string;
  country?: string;
  organizationId?: string;
}): Promise<MapsSearchResult[]> {
  const queryParams: Record<string, string> = { query: params.query.trim() };
  if (params.lat != null && params.lng != null) {
    // ScrapingDog docs: ll=@lat,lng,zoomz — not DataForSEO's location_coordinate.
    const zoom = params.zoom ?? 14;
    const z = Number.isFinite(zoom) ? Math.min(30, Math.max(3, zoom)) : 14;
    const lat = Math.round(params.lat * 1e7) / 1e7;
    const lng = Math.round(params.lng * 1e7) / 1e7;
    queryParams.ll = `@${lat},${lng},${z}z`;
  }
  if (params.domain) queryParams.domain = params.domain;
  if (params.language) queryParams.language = params.language;
  if (params.country) queryParams.country = params.country;

  const data = await scrapingDogGet<{ search_results?: MapsSearchResult[] } | MapsSearchResult[]>(
    "google_maps",
    queryParams,
    params.organizationId
  );
  if (Array.isArray(data)) return data;
  return data.search_results ?? [];
}

export { buildMapsGridRequest, mapsGridCell, mapsGridDepth, normalizeScrapingDogResults } from "@/lib/providers/scrapingdog/maps-grid";
export type { MapsGridRequest } from "@/lib/providers/scrapingdog/maps-grid";

export async function placeDetails(params: {
  placeId: string;
  organizationId?: string;
}): Promise<Record<string, unknown>> {
  return scrapingDogGet("google_maps/places", { place_id: params.placeId }, params.organizationId);
}

function extractDataIdFromPlaceDetails(details: Record<string, unknown>): string | null {
  const placeResults = details.place_results as { data_id?: string } | undefined;
  const candidates = [
    placeResults?.data_id,
    details.data_id as string | undefined,
    (details.place as { data_id?: string })?.data_id,
  ];
  for (const c of candidates) {
    if (c?.startsWith("0x") && c.includes(":")) return c;
  }
  return null;
}

function pickSearchResultByPlaceId(
  results: MapsSearchResult[],
  placeId: string
): MapsSearchResult | undefined {
  return results.find((r) => r.place_id === placeId);
}

/**
 * Resolve ScrapingDog hex data_id from hex cid, place details, or maps search.
 */
export async function resolveScrapingDogDataId(params: {
  placeId?: string | null;
  cid?: string | null;
  name?: string | null;
  organizationId?: string;
  /** Skip place_details and go straight to maps search */
  searchOnly?: boolean;
}): Promise<{ dataId: string | null; source: string }> {
  const fromCid = params.cid?.replace(/^cid:/, "").trim();
  if (!params.searchOnly && fromCid?.startsWith("0x") && fromCid.includes(":")) {
    return { dataId: fromCid, source: "hex_cid" };
  }

  const placeId = params.placeId?.trim();

  if (!params.searchOnly && placeId && (placeId.startsWith("ChIJ") || placeId.startsWith("GhIJ"))) {
    try {
      const details = await placeDetails({ placeId, organizationId: params.organizationId });
      const fromDetails = extractDataIdFromPlaceDetails(details);
      if (fromDetails) {
        console.log("[ScrapingDog] data_id_resolved", {
          place_id: placeId,
          data_id: fromDetails,
          source: "place_details",
        });
        return { dataId: fromDetails, source: "place_details" };
      }
      console.warn("[ScrapingDog] place_details_no_data_id", {
        place_id: placeId,
        keys: Object.keys(details).slice(0, 12),
      });
    } catch (err) {
      console.warn("[ScrapingDog] place_details_failed", {
        place_id: placeId,
        error: err instanceof Error ? err.message : String(err),
        ...(err instanceof ScrapingDogHttpError
          ? { httpStatus: err.status, responsePreview: summarizeResponse(err.responseBody) }
          : {}),
      });
    }
  }

  if (params.name?.trim()) {
    try {
      const results = await mapsSearch({
        query: params.name.trim(),
        organizationId: params.organizationId,
      });
      const byPlaceId = placeId ? pickSearchResultByPlaceId(results, placeId) : undefined;
      const match = byPlaceId ?? (placeId ? undefined : results.find((r) => r.data_id?.startsWith("0x")) ?? results[0]);

      if (byPlaceId?.data_id?.startsWith("0x")) {
        console.log("[ScrapingDog] data_id_resolved", {
          place_id: placeId ?? null,
          name: params.name,
          data_id: byPlaceId.data_id,
          source: "maps_search",
          matchedTitle: byPlaceId.title,
        });
        return { dataId: byPlaceId.data_id, source: "maps_search" };
      }

      if (!placeId && match?.data_id?.startsWith("0x")) {
        console.log("[ScrapingDog] data_id_resolved", {
          place_id: null,
          name: params.name,
          data_id: match.data_id,
          source: "maps_search",
          matchedTitle: match.title,
        });
        return { dataId: match.data_id, source: "maps_search" };
      }

      console.warn("[ScrapingDog] maps_search_no_match", {
        name: params.name,
        place_id: placeId ?? null,
        resultCount: results.length,
        titles: results.slice(0, 5).map((r) => ({ title: r.title, place_id: r.place_id })),
        reason: placeId
          ? "No search result matched place_id — refusing wrong-business fallback"
          : "No data_id in search results",
      });
    } catch (err) {
      console.warn("[ScrapingDog] maps_search_failed", {
        name: params.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { dataId: null, source: "unresolved" };
}

export type ReviewsSortBy = "newestFirst" | "qualityScore" | "ratingHigh" | "ratingLow";

export async function placeReviewsPage(params: {
  dataId: string;
  organizationId?: string;
  nextPageToken?: string;
  pageSize?: number;
  sortBy?: ReviewsSortBy;
}): Promise<{
  reviews: unknown[];
  nextPageToken: string | null;
  sortByUsed: ReviewsSortBy;
}> {
  const sortBy = params.sortBy ?? "newestFirst";
  const query: Record<string, string> = {
    data_id: params.dataId,
    sort_by: sortBy,
  };

  if (params.nextPageToken) {
    query.next_page_token = params.nextPageToken;
    if (params.pageSize) query.results = String(Math.min(params.pageSize, 20));
  }

  const data = await scrapingDogGet<{
    reviews?: unknown[];
    reviews_results?: unknown[];
    pagination?: { next_page_token?: string };
  }>("google_maps/reviews", query, params.organizationId);

  const batch = data.reviews_results ?? data.reviews ?? [];
  return {
    reviews: Array.isArray(batch) ? batch : [],
    nextPageToken: data.pagination?.next_page_token ?? null,
    sortByUsed: sortBy,
  };
}

/** First page with fallbacks: newestFirst → qualityScore (no sort) on 400 */
async function placeReviewsFirstPage(params: {
  dataId: string;
  organizationId?: string;
}): Promise<{
  reviews: unknown[];
  nextPageToken: string | null;
  sortByUsed: ReviewsSortBy;
}> {
  const sorts: ReviewsSortBy[] = ["newestFirst", "qualityScore"];
  let lastErr: unknown;

  for (const sortBy of sorts) {
    try {
      const result = await placeReviewsPage({
        dataId: params.dataId,
        organizationId: params.organizationId,
        sortBy,
      });
      if (sortBy !== "newestFirst") {
        console.log("[ScrapingDog] reviews_sort_fallback_ok", {
          data_id: params.dataId,
          sortBy,
          reviewCount: result.reviews.length,
        });
      }
      return result;
    } catch (err) {
      lastErr = err;
      const is400 = err instanceof ScrapingDogHttpError && err.status === 400;
      console.warn("[ScrapingDog] reviews_page_failed", {
        data_id: params.dataId,
        sortBy,
        willRetry: is400 && sortBy === "newestFirst",
        error: err instanceof Error ? err.message : String(err),
        ...(err instanceof ScrapingDogHttpError
          ? { httpStatus: err.status, responsePreview: summarizeResponse(err.responseBody) }
          : {}),
      });
      if (!is400 || sortBy !== "newestFirst") break;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function placeReviewsAll(params: {
  dataId: string;
  organizationId?: string;
  lookbackDays?: number;
  maxPages?: number;
  pageSize?: number;
  /** Stop pagination when hitting a known review id (incremental sync) */
  stopAtSourceIds?: Set<string>;
}): Promise<{ reviews: unknown[]; pagesFetched: number; stoppedReason: string }> {
  const lookbackDays = params.lookbackDays ?? 90;
  const maxPages = params.maxPages ?? 25;
  const pageSize = params.pageSize ?? 20;
  const cutoff = startOfDay(subDays(new Date(), lookbackDays));

  const all: unknown[] = [];
  const seenIds = new Set<string>();
  let nextToken: string | null = null;
  let pagesFetched = 0;
  let stoppedReason = "no_more_pages";
  let sortByUsed: ReviewsSortBy = "newestFirst";

  for (let page = 0; page < maxPages; page++) {
    const result: {
      reviews: unknown[];
      nextPageToken: string | null;
      sortByUsed: ReviewsSortBy;
    } =
      page === 0
        ? await placeReviewsFirstPage({
            dataId: params.dataId,
            organizationId: params.organizationId,
          })
        : await placeReviewsPage({
            dataId: params.dataId,
            organizationId: params.organizationId,
            nextPageToken: nextToken ?? undefined,
            pageSize: pageSize,
            sortBy: sortByUsed,
          });

    if (page === 0) sortByUsed = result.sortByUsed;
    pagesFetched++;

    let oldestOnPage: Date | null = null;
    let hitKnown = false;
    for (const raw of result.reviews) {
      const r = raw as { review_id?: string; id?: string };
      const id = r.review_id ?? r.id;
      if (id && params.stopAtSourceIds?.has(id)) {
        hitKnown = true;
        break;
      }
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      all.push(raw);

      const iso = (raw as { iso_date?: string }).iso_date;
      if (iso) {
        const d = parseISO(iso);
        if (isValid(d)) {
          const day = startOfDay(d);
          if (!oldestOnPage || day < oldestOnPage) oldestOnPage = day;
        }
      }
    }

    if (hitKnown) {
      stoppedReason = "incremental_sync";
      break;
    }

    if (oldestOnPage && oldestOnPage < cutoff) {
      stoppedReason = "lookback_reached";
      break;
    }

    if (!result.nextPageToken) {
      stoppedReason = "no_more_pages";
      break;
    }
    nextToken = result.nextPageToken;
  }

  if (pagesFetched >= maxPages) stoppedReason = "max_pages";

  logScrapingDogSuccess({
    endpoint: "google_maps/reviews",
    requestParams: { data_id: params.dataId },
    status: 200,
    latencyMs: 0,
    itemHint: `${all.length} reviews, ${pagesFetched} pages, ${stoppedReason}`,
  });

  return { reviews: all, pagesFetched, stoppedReason };
}

/** @deprecated Use placeReviewsPage or placeReviewsAll */
export async function placeReviews(params: {
  placeId?: string;
  dataId?: string;
  organizationId?: string;
  results?: number;
}): Promise<unknown[]> {
  const dataId = params.dataId ?? params.placeId;
  if (!dataId) return [];

  const { reviews } = await placeReviewsPage({ dataId, organizationId: params.organizationId });
  return reviews;
}

export async function placePhotos(params: {
  placeId: string;
  organizationId?: string;
}): Promise<unknown[]> {
  const data = await scrapingDogGet<{ photos?: unknown[] }>(
    "google_maps/photos",
    { place_id: params.placeId },
    params.organizationId
  );
  return data.photos ?? [];
}

export async function placePosts(params: {
  placeId: string;
  organizationId?: string;
}): Promise<unknown[]> {
  const data = await scrapingDogGet<{ posts?: unknown[] }>(
    "google_maps/posts",
    { place_id: params.placeId },
    params.organizationId
  );
  return data.posts ?? [];
}

export async function scrapeWebsite(params: {
  url: string;
  organizationId?: string;
}): Promise<string> {
  const data = await scrapingDogGet<{ html?: string }>(
    "scrape",
    { url: params.url, dynamic: "false" },
    params.organizationId
  );
  return data.html ?? "";
}
