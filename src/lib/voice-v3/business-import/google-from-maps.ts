import type { GoogleMapsSearchResult } from "@/lib/scrapingdog/client";
import type { BusinessExtractionCandidate } from "./types";

export function candidateFromGooglePlace(
  searchRow: GoogleMapsSearchResult,
  placeDetails?: Record<string, unknown>,
): Partial<BusinessExtractionCandidate> {
  const title = searchRow.title || str(placeDetails?.title) || str(placeDetails?.name);
  const address = searchRow.address || str(placeDetails?.address);
  const phone = searchRow.phone || str(placeDetails?.phone);
  const website = searchRow.website || str(placeDetails?.website);
  let hoursProse: string | undefined;
  const hours = searchRow.hours ?? placeDetails?.hours ?? placeDetails?.operating_hours;
  if (typeof hours === "string") hoursProse = hours;
  else if (hours) hoursProse = JSON.stringify(hours);

  return {
    business: {
      name: title,
      address,
      phone,
      website,
    },
    hoursProse,
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
