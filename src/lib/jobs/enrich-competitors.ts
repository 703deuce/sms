import "server-only";

import { placeDetails } from "@/lib/providers/scrapingdog";

export interface EnrichedProfile {
  name: string;
  category?: string | null;
  additional_categories?: string[];
  rating?: number;
  review_count?: number;
  photo_count?: number;
  post_count?: number;
  is_claimed?: boolean;
  description?: string;
  place_topics?: unknown[];
  justifications?: unknown[];
  recent_review_count?: number;
}

/**
 * Lightweight business enrichment for Review Velocity (no LSE grid / DataForSEO dependency).
 */
export async function enrichTargetBusiness(params: {
  name: string;
  cid?: string | null;
  placeId?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  organizationId?: string;
}): Promise<EnrichedProfile> {
  const profile: EnrichedProfile = { name: params.name };

  const placeId = params.placeId?.trim();
  if (!placeId) return profile;

  try {
    const details = await placeDetails({ placeId, organizationId: params.organizationId });
    profile.category = (details.category as string) ?? (details.type as string) ?? profile.category;
    profile.description = (details.description as string) ?? profile.description;
    if (typeof details.rating === "number") profile.rating = details.rating;
    if (typeof details.review_count === "number") profile.review_count = details.review_count;
    if (typeof details.user_ratings_total === "number") {
      profile.review_count = details.user_ratings_total;
    }
    profile.name = (details.name as string) ?? (details.title as string) ?? profile.name;
  } catch (err) {
    console.warn("[enrichTargetBusiness] placeDetails failed:", err);
  }

  return profile;
}
