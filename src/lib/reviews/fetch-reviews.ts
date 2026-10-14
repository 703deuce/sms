import { placeReviewsAll, ScrapingDogHttpError } from "@/lib/providers/scrapingdog";
import { ensureScrapingDogDataId } from "@/lib/reviews/ensure-scrapingdog-data-id";
import {
  normalizeScrapingDogReview,
  type NormalizedReview,
} from "@/lib/reviews/normalize";
import { resolveReviewLookupId } from "@/lib/reviews/resolve-lookup-id";

export { resolveReviewLookupId };
export type { ReviewLookupBusiness, ReviewLookupIds } from "@/lib/reviews/resolve-lookup-id";

export interface FetchReviewsResult {
  reviews: NormalizedReview[];
  provider: string;
  warnings: string[];
  velocityAvailable: boolean;
  velocityWarning: string | null;
  scrapingDogDataId: string | null;
  dataForSeoPlaceId: string | null;
  fallbackUsed: boolean;
  dataIdValidated: boolean;
  /** Why pagination stopped (lookback_reached, incremental_sync, …). */
  stoppedReason: string | null;
  /**
   * Provider returned zero rows because nothing new since last sync.
   * This is NOT “zero reviews in the lookback window” — reload totals from DB.
   */
  incrementalNoNew: boolean;
  /** @deprecated use warnings[] */
  warning?: string;
}

export interface FetchReviewsParams {
  placeId?: string | null;
  place_id?: string | null;
  cid?: string | null;
  name: string;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  organizationId?: string;
  depth?: number;
  /** How far back to paginate reviews (default 90) */
  lookbackDays?: number;
  mapsTotalReviews?: number | null;
  mapsRating?: number | null;
  /** Use hex data_id previously stored in cid (target only — grid competitors use place_id only) */
  allowStoredHex?: boolean;
  /** Known review IDs — stop fetch early when encountered (newest-first pagination) */
  stopAtSourceIds?: Set<string>;
}

function logReviewFetch(event: string, details: Record<string, unknown>): void {
  console.log(`[ReviewFetch] ${event}`, details);
}

function logReviewFetchError(event: string, details: Record<string, unknown>): void {
  console.error(`[ReviewFetch] ${event}`, details);
}

function scrapingDogErrorDetails(err: unknown): Record<string, unknown> {
  if (err instanceof ScrapingDogHttpError) {
    return {
      httpStatus: err.status,
      endpoint: err.endpoint,
      request: err.requestParams,
      responsePreview:
        typeof err.responseBody === "object"
          ? JSON.stringify(err.responseBody).slice(0, 400)
          : String(err.responseBody).slice(0, 400),
    };
  }
  return {};
}

async function fetchScrapingDogReviews(params: {
  dataId: string;
  lookbackDays: number;
  organizationId?: string;
  baseLog: Record<string, unknown>;
  stopAtSourceIds?: Set<string>;
}): Promise<{ reviews: NormalizedReview[]; pagesFetched: number; stoppedReason: string }> {
  const paged = await placeReviewsAll({
    dataId: params.dataId,
    organizationId: params.organizationId,
    lookbackDays: params.lookbackDays,
    stopAtSourceIds: params.stopAtSourceIds,
  });
  const reviews = paged.reviews.map(normalizeScrapingDogReview);
  if (!reviews.length) {
    const incremental = paged.stoppedReason === "incremental_sync";
    logReviewFetch(incremental ? "scrapingdog_incremental_empty" : "scrapingdog_empty", {
      ...params.baseLog,
      data_id: params.dataId,
      pagesFetched: paged.pagesFetched,
      stoppedReason: paged.stoppedReason,
      note: incremental
        ? "No new reviews since last sync — not an empty lookback window"
        : "Validated data_id — provider returned 0 reviews on this fetch",
    });
  }
  return { reviews, pagesFetched: paged.pagesFetched, stoppedReason: paged.stoppedReason };
}

function countRecentReviews(reviews: NormalizedReview[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return reviews.filter((r) => r.reviewDate && r.reviewDate.getTime() >= cutoff).length;
}

/**
 * Shared review provider: ScrapingDog only (dated reviews for velocity).
 * DataForSEO reviews are not used — they do not provide reliable review dates for momentum.
 *
 * Before fetching, resolves hex data_id via ScrapingDog and validates it against the reviews API.
 * DFS grid scans only provide numeric CID — that cannot be used directly.
 *
 * Important: an incremental sync that returns 0 reviews means “nothing new since last sync”,
 * not “zero reviews in the lookback window”. Callers must merge into storage and count
 * lookback totals from the database.
 */
export async function fetchReviewsForEntity(params: FetchReviewsParams): Promise<FetchReviewsResult> {
  const ids = resolveReviewLookupId(params);
  const warnings: string[] = [];

  const baseLog = {
    businessName: params.name,
    place_id: ids.dataForSeoPlaceId,
    cid: params.cid ?? null,
    city: params.city ?? null,
    state: params.state ?? null,
  };

  logReviewFetch("start", baseLog);

  if (!ids.dataForSeoPlaceId && !ids.scrapingDogDataId) {
    const reason = ids.skipReason ?? "No place_id or data_id available for review lookup";
    logReviewFetchError("skipped", { ...baseLog, reason });
    warnings.push(reason);
    return buildUnavailableResult({ ...ids, scrapingDogDataId: null }, warnings, params, "none", false);
  }

  const ensured = await ensureScrapingDogDataId({
    name: params.name,
    placeId: ids.dataForSeoPlaceId,
    cid: params.cid,
    city: params.city,
    state: params.state,
    organizationId: params.organizationId,
    allowStoredHex: params.allowStoredHex ?? true,
  });

  const scrapingDogDataId = ensured.validated ? ensured.dataId : null;

  if (!scrapingDogDataId) {
    const reason =
      ensured.skipReason ??
      `Could not resolve a working ScrapingDog data_id for ${params.name}`;
    logReviewFetchError("data_id_preflight_failed", {
      ...baseLog,
      dfsNumericCid: ensured.dfsNumericCid,
      attempts: ensured.attempts,
      reason,
    });
    warnings.push(reason);
    return buildUnavailableResult(
      { ...ids, scrapingDogDataId: ensured.dataId },
      warnings,
      params,
      "scrapingdog",
      false
    );
  }

  const lookbackDays = params.lookbackDays ?? 90;
  logReviewFetch("scrapingdog_attempt", {
    ...baseLog,
    data_id: scrapingDogDataId,
    dataIdSource: ensured.source,
    provider: "scrapingdog",
    lookbackDays,
    validated: true,
    incremental: Boolean(params.stopAtSourceIds?.size),
  });

  try {
    const result = await fetchScrapingDogReviews({
      dataId: scrapingDogDataId,
      lookbackDays,
      organizationId: params.organizationId,
      baseLog: { ...baseLog, data_id: scrapingDogDataId, dataIdSource: ensured.source },
      stopAtSourceIds: params.stopAtSourceIds,
    });
    const incrementalNoNew =
      result.reviews.length === 0 && result.stoppedReason === "incremental_sync";

    if (result.reviews.length > 0) {
      logReviewFetch("scrapingdog_success", {
        ...baseLog,
        data_id: scrapingDogDataId,
        dataIdSource: ensured.source,
        provider: "scrapingdog",
        reviewCount: result.reviews.length,
        recent30d: countRecentReviews(result.reviews, 30),
        recent90d: countRecentReviews(result.reviews, 90),
        pagesFetched: result.pagesFetched,
        stoppedReason: result.stoppedReason,
      });
    } else if (!incrementalNoNew) {
      logReviewFetch("scrapingdog_empty", {
        ...baseLog,
        data_id: scrapingDogDataId,
        stoppedReason: result.stoppedReason,
        note: "Provider returned 0 reviews on this fetch — lookback totals must still come from DB after merge",
      });
    }

    return {
      reviews: result.reviews,
      provider: "scrapingdog",
      warnings,
      velocityAvailable: true,
      velocityWarning: null,
      scrapingDogDataId,
      dataForSeoPlaceId: ids.dataForSeoPlaceId,
      fallbackUsed: false,
      dataIdValidated: true,
      stoppedReason: result.stoppedReason,
      incrementalNoNew,
      warning: warnings[0],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logReviewFetchError("scrapingdog_error", {
      ...baseLog,
      data_id: scrapingDogDataId,
      provider: "scrapingdog",
      error: message,
      ...scrapingDogErrorDetails(err),
    });
    warnings.push(`ScrapingDog error: ${message}`);
  }

  return buildUnavailableResult(
    { ...ids, scrapingDogDataId },
    warnings,
    params,
    "scrapingdog",
    true
  );
}

function buildUnavailableResult(
  ids: ReturnType<typeof resolveReviewLookupId> & { scrapingDogDataId: string | null },
  warnings: string[],
  params: FetchReviewsParams,
  lastProvider: string,
  dataIdValidated: boolean
): FetchReviewsResult {
  const total = params.mapsTotalReviews;
  const velocityWarning =
    total != null && total > 0
      ? `${params.name} has ${total} total reviews, but dated review history was unavailable, so velocity could not be calculated.`
      : `No dated review history available for ${params.name}.`;

  if (total != null && total > 0) {
    warnings.push(velocityWarning);
  } else if (!warnings.length) {
    warnings.push(`No review data for ${params.name}`);
  }

  logReviewFetch("unavailable", {
    businessName: params.name,
    place_id: ids.dataForSeoPlaceId,
    cid: params.cid ?? null,
    data_id: ids.scrapingDogDataId,
    provider: lastProvider,
    warnings,
    mapsTotalReviews: total,
    dataIdValidated,
  });

  return {
    reviews: [],
    provider: lastProvider === "none" ? "none" : lastProvider,
    warnings,
    velocityAvailable: false,
    velocityWarning,
    scrapingDogDataId: ids.scrapingDogDataId,
    dataForSeoPlaceId: ids.dataForSeoPlaceId,
    fallbackUsed: lastProvider !== "none",
    dataIdValidated,
    stoppedReason: null,
    incrementalNoNew: false,
    warning: warnings[0],
  };
}
