/**
 * Google Business Profile API — connected account mode.
 * Requires GCP project approval + OAuth. Stub until Firebase auth is wired.
 */

export interface GoogleConnectionStatus {
  connected: boolean;
  oauth_status: string;
  capabilities: string[];
}

export function getConnectionStatus(): GoogleConnectionStatus {
  return {
    connected: false,
    oauth_status: "disconnected",
    capabilities: [
      "location_sync",
      "review_reply",
      "local_posts",
      "media_upload",
      "performance_insights",
      "notifications",
    ],
  };
}

export async function listLocations(_accessToken: string): Promise<unknown[]> {
  throw new Error("Google Business Profile API not configured. Complete OAuth setup first.");
}

export async function replyToReview(_params: {
  accessToken: string;
  reviewId: string;
  comment: string;
}): Promise<void> {
  throw new Error("Google Business Profile API not configured.");
}

export async function createLocalPost(_params: {
  accessToken: string;
  locationId: string;
  summary: string;
}): Promise<void> {
  throw new Error("Google Business Profile API not configured.");
}
