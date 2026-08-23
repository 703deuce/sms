import { randomTrackingToken } from "@/lib/messaging/crypto";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";

const URL_IN_TEXT =
  /\bhttps?:\/\/[^\s<>"')\]]+/gi;

export function validateMctbLinkDestinationUrl(raw: string): {
  ok: boolean;
  url?: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "empty_url" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "invalid_url" };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { ok: false, error: "unsupported_protocol" };
  }

  if (/^javascript:/i.test(trimmed)) {
    return { ok: false, error: "blocked_scheme" };
  }

  return { ok: true, url: parsed.toString() };
}

export function buildTrackedRedirectUrl(trackingToken: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  return `${base}/r/${encodeURIComponent(trackingToken)}`;
}

export function wrapMctbMessageUrlsWithTracking(input: {
  body: string;
  destinationUrl?: string | null;
  trackingToken?: string | null;
}): { body: string; trackingToken: string; destinationUrl: string | null } {
  const token = input.trackingToken || randomTrackingToken();
  const trackedUrl = buildTrackedRedirectUrl(token);

  let primaryDestination: string | null = null;
  if (input.destinationUrl) {
    const validated = validateMctbLinkDestinationUrl(input.destinationUrl);
    if (validated.ok && validated.url) {
      primaryDestination = validated.url;
    }
  }

  let body = input.body;
  const matches = [...body.matchAll(URL_IN_TEXT)];
  for (const match of matches) {
    const raw = match[0]?.replace(/[)>.,]+$/, "") || "";
    const validated = validateMctbLinkDestinationUrl(raw);
    if (!validated.ok || !validated.url) continue;
    if (!primaryDestination) primaryDestination = validated.url;
    body = body.replace(raw, trackedUrl);
  }

  if (primaryDestination && !body.includes(trackedUrl)) {
    body = `${body.trim()}\n${trackedUrl}`.trim();
  }

  return {
    body,
    trackingToken: token,
    destinationUrl: primaryDestination,
  };
}
