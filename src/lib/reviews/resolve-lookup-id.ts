export interface ReviewLookupBusiness {
  name?: string;
  place_id?: string | null;
  placeId?: string | null;
  cid?: string | null;
}

export interface ReviewLookupIds {
  scrapingDogDataId: string | null;
  dataForSeoPlaceId: string | null;
  skipReason: string | null;
}

function isGooglePlaceId(id: string): boolean {
  return id.startsWith("ChIJ") || id.startsWith("GhIJ");
}

export function normalizeCid(cid?: string | null): string | null {
  if (!cid) return null;
  const c = cid.replace(/^cid:/, "").trim();
  return c || null;
}

export function isHexDataId(value?: string | null): boolean {
  const c = normalizeCid(value);
  return !!c?.startsWith("0x") && c.includes(":");
}

export function hexDataIdFromCid(cid?: string | null): string | null {
  return isHexDataId(cid) ? normalizeCid(cid) : null;
}

/**
 * Resolve review API identifiers for a business.
 * ScrapingDog requires hex data_id (0x...:0x...). DataForSEO reviews requires place_id.
 */
export function resolveReviewLookupId(business: ReviewLookupBusiness): ReviewLookupIds {
  const cid = normalizeCid(business.cid);
  const placeId = (business.place_id ?? business.placeId ?? null)?.trim() || null;

  const scrapingDogDataId = hexDataIdFromCid(cid);

  const dataForSeoPlaceId = placeId && isGooglePlaceId(placeId) ? placeId : null;

  let skipReason: string | null = null;
  if (!scrapingDogDataId && !dataForSeoPlaceId) {
    if (cid && !cid.startsWith("0x")) {
      skipReason =
        "DFS grid provides numeric CID only — ScrapingDog reviews need hex data_id resolved via place_id";
    } else if (!cid && !placeId) {
      skipReason = "No place_id or hex CID available for review lookup";
    } else if (placeId && !isGooglePlaceId(placeId)) {
      skipReason = `Invalid place_id format: ${placeId.slice(0, 12)}…`;
    } else {
      skipReason = "No valid review lookup identifiers";
    }
  }

  return { scrapingDogDataId, dataForSeoPlaceId, skipReason };
}
