import {
  mapsSearch,
  placeReviewsPage,
  resolveScrapingDogDataId,
} from "@/lib/providers/scrapingdog";
import { hexDataIdFromCid, isHexDataId, normalizeCid } from "@/lib/reviews/resolve-lookup-id";

export interface DataIdAttempt {
  source: string;
  dataId: string;
  reviewsOk: boolean;
  error?: string;
}

export interface EnsureDataIdResult {
  dataId: string | null;
  source: string | null;
  validated: boolean;
  placeId: string | null;
  /** Numeric CID from DataForSEO grid — not usable for ScrapingDog reviews */
  dfsNumericCid: string | null;
  attempts: DataIdAttempt[];
  skipReason: string | null;
}

async function probeReviewsDataId(
  dataId: string,
  organizationId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await placeReviewsPage({
      dataId,
      organizationId,
      sortBy: "qualityScore",
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

function pickSearchResultByPlaceId(
  results: Array<{ place_id?: string; data_id?: string; title?: string }>,
  placeId: string
) {
  return results.find((r) => r.place_id === placeId);
}

function buildSearchQueries(name: string, city?: string | null, state?: string | null): string[] {
  const queries: string[] = [];
  const loc = [city, state].filter(Boolean).join(" ");
  if (loc) queries.push(`${name} ${loc}`.trim());
  if (city) queries.push(`${name} ${city}`.trim());
  queries.push(name.trim());
  return [...new Set(queries)];
}

/**
 * Resolve AND validate a ScrapingDog hex data_id before review fetch.
 *
 * DataForSEO grid scans only store numeric CID + place_id — never data_id.
 * ScrapingDog reviews require hex data_id (0x...:0x...).
 * place_details sometimes returns a data_id that the reviews API still rejects (400).
 */
export async function ensureScrapingDogDataId(params: {
  name: string;
  placeId?: string | null;
  cid?: string | null;
  city?: string | null;
  state?: string | null;
  organizationId?: string;
  /** Prior-run hex data_id stored in cid — only used when true (target business) */
  allowStoredHex?: boolean;
}): Promise<EnsureDataIdResult> {
  const placeId = params.placeId?.trim() || null;
  const cid = normalizeCid(params.cid);
  const dfsNumericCid = cid && !isHexDataId(cid) ? cid : null;
  const attempts: DataIdAttempt[] = [];
  const tried = new Set<string>();

  async function tryCandidate(dataId: string, source: string): Promise<boolean> {
    if (!dataId.startsWith("0x") || tried.has(dataId)) return false;
    tried.add(dataId);
    const probe = await probeReviewsDataId(dataId, params.organizationId);
    attempts.push({
      source,
      dataId,
      reviewsOk: probe.ok,
      error: probe.error,
    });
    if (probe.ok) {
      console.log("[ReviewFetch] data_id_validated", {
        businessName: params.name,
        place_id: placeId,
        dfsNumericCid,
        data_id: dataId,
        source,
      });
      return true;
    }
    console.warn("[ReviewFetch] data_id_rejected_by_reviews_api", {
      businessName: params.name,
      place_id: placeId,
      data_id: dataId,
      source,
      error: probe.error,
      ...(probe.error && probe.error.includes("400")
        ? { hint: "place_details data_id may not work for reviews — trying search next" }
        : {}),
    });
    return false;
  }

  // 1. Prior-run hex data_id stored in cid (never numeric DFS CID)
  const storedHex = params.allowStoredHex ? hexDataIdFromCid(cid) : null;
  if (storedHex && (await tryCandidate(storedHex, "stored_hex_cid"))) {
    return {
      dataId: storedHex,
      source: "stored_hex_cid",
      validated: true,
      placeId,
      dfsNumericCid,
      attempts,
      skipReason: null,
    };
  }

  // 2. ScrapingDog place_details via Google place_id (never via numeric CID)
  if (placeId) {
    const fromDetails = await resolveScrapingDogDataId({
      placeId,
      organizationId: params.organizationId,
    });
    if (fromDetails.dataId && (await tryCandidate(fromDetails.dataId, "place_details"))) {
      return {
        dataId: fromDetails.dataId,
        source: "place_details",
        validated: true,
        placeId,
        dfsNumericCid,
        attempts,
        skipReason: null,
      };
    }
  }

  // 3. ScrapingDog maps search — must match place_id exactly (geo-qualified queries)
  if (placeId && params.name) {
    for (const query of buildSearchQueries(params.name, params.city, params.state)) {
      try {
        const results = await mapsSearch({ query, organizationId: params.organizationId });
        const match = pickSearchResultByPlaceId(results, placeId);
        if (match?.data_id?.startsWith("0x")) {
          if (await tryCandidate(match.data_id, `maps_search:${query}`)) {
            console.log("[ScrapingDog] data_id_resolved", {
              place_id: placeId,
              name: params.name,
              data_id: match.data_id,
              source: "maps_search",
              query,
              matchedTitle: match.title,
            });
            return {
              dataId: match.data_id,
              source: "maps_search",
              validated: true,
              placeId,
              dfsNumericCid,
              attempts,
              skipReason: null,
            };
          }
        } else {
          console.warn("[ScrapingDog] maps_search_no_place_match", {
            query,
            place_id: placeId,
            name: params.name,
            resultCount: results.length,
            topTitles: results.slice(0, 3).map((r) => ({ title: r.title, place_id: r.place_id })),
          });
        }
      } catch (err) {
        console.warn("[ScrapingDog] maps_search_failed", {
          query,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  let skipReason: string;
  if (!placeId) {
    skipReason = "No Google place_id — cannot resolve ScrapingDog data_id (DFS only provides numeric CID)";
  } else if (dfsNumericCid) {
    skipReason = `DFS numeric CID (${dfsNumericCid}) cannot be used for ScrapingDog reviews; could not resolve valid data_id for place_id ${placeId}`;
  } else {
    skipReason = `Could not resolve a ScrapingDog data_id that passes reviews API validation for ${params.name}`;
  }

  console.error("[ReviewFetch] data_id_preflight_failed", {
    businessName: params.name,
    place_id: placeId,
    dfsNumericCid,
    city: params.city ?? null,
    state: params.state ?? null,
    attempts,
    skipReason,
  });

  return {
    dataId: attempts.find((a) => a.reviewsOk)?.dataId ?? attempts[0]?.dataId ?? null,
    source: null,
    validated: false,
    placeId,
    dfsNumericCid,
    attempts,
    skipReason,
  };
}
