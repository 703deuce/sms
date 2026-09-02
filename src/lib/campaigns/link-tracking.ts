import { randomTrackingToken } from "@/lib/messaging/crypto";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";

export type TrackedLinkConfig = {
  url: string;
  name: string;
  tracked: boolean;
};

export type LinkTrackingResult = {
  body: string;
  primaryToken: string | null;
  primaryDestination: string | null;
  /** Additional redirect tokens stored as Message stubs for /r/{token} lookup. */
  redirectStubs: Array<{ token: string; destinationUrl: string }>;
};


function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/[)>.,;!?]+$/, "");
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceUrlInBody(body: string, sourceUrl: string, trackedUrl: string): string {
  const normalized = normalizeUrl(sourceUrl);
  const variants = [sourceUrl.trim(), normalized];
  if (normalized.startsWith("https://")) {
    variants.push(normalized.replace(/^https:\/\//i, "http://"));
  }
  let next = body;
  for (const variant of [...new Set(variants)]) {
    if (!variant) continue;
    next = next.replace(new RegExp(escapeRegExp(variant), "gi"), trackedUrl);
  }
  return next;
}

export function applyCampaignLinkTracking(input: {
  body: string;
  trackedLinks?: TrackedLinkConfig[];
  trackLinks?: boolean;
  fallbackDestination?: string;
}): LinkTrackingResult {
  const baseUrl = getAppBaseUrl();
  const trackedEntries = (input.trackedLinks || []).filter((link) => link.tracked && link.url.trim());
  const redirectStubs: Array<{ token: string; destinationUrl: string }> = [];
  let body = input.body;
  let primaryToken: string | null = null;
  let primaryDestination: string | null = null;

  if (trackedEntries.length > 0) {
    for (const entry of trackedEntries) {
      const destinationUrl = normalizeUrl(entry.url);
      const token = randomTrackingToken();
      const trackedUrl = `${baseUrl}/r/${token}`;
      body = replaceUrlInBody(body, entry.url, trackedUrl);
      if (!primaryToken) {
        primaryToken = token;
        primaryDestination = destinationUrl;
      } else {
        redirectStubs.push({ token, destinationUrl });
      }
    }
    return { body, primaryToken, primaryDestination, redirectStubs };
  }

  if (
    input.trackLinks ||
    body.includes("{{tracking_link}}") ||
    body.includes("{{review_link}}")
  ) {
    const token = randomTrackingToken();
    const trackedUrl = `${baseUrl}/r/${token}`;
    const destination = input.fallbackDestination?.trim() || null;
    return {
      body,
      primaryToken: token,
      primaryDestination: destination,
      redirectStubs: [],
    };
  }

  return { body, primaryToken: null, primaryDestination: null, redirectStubs: [] };
}
