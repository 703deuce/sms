/**
 * Shared ScrapingDog client (Google Maps + web scrape).
 * Env: SCRAPINGDOG_API_KEY — align with Local SEO Express when that code lands in-repo.
 */

const BASE = "https://api.scrapingdog.com";
const DEFAULT_TIMEOUT_MS = 25_000;

export function getScrapingDogApiKey(): string | null {
  const key = process.env.SCRAPINGDOG_API_KEY?.trim();
  return key || null;
}

export function isScrapingDogConfigured(): boolean {
  return Boolean(getScrapingDogApiKey());
}

export type ScrapingDogFetchMode = "direct" | "static" | "dynamic";

export async function scrapingDogGet(
  path: string,
  params: Record<string, string | undefined>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const apiKey = getScrapingDogApiKey();
  if (!apiKey) {
    throw new Error("SCRAPINGDOG_API_KEY is not configured");
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ScrapingDog ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

export type GoogleMapsSearchResult = {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  place_id?: string;
  data_id?: string;
  ludocid?: string;
  hours?: unknown;
};

function normalizeSearchRow(row: Record<string, unknown>): GoogleMapsSearchResult {
  return {
    title: typeof row.title === "string" ? row.title : typeof row.name === "string" ? row.name : undefined,
    address: typeof row.address === "string" ? row.address : undefined,
    phone: typeof row.phone === "string" ? row.phone : undefined,
    website: typeof row.website === "string" ? row.website : undefined,
    rating: typeof row.rating === "number" ? row.rating : undefined,
    reviews: typeof row.reviews === "number" ? row.reviews : undefined,
    place_id: typeof row.place_id === "string" ? row.place_id : undefined,
    data_id: typeof row.data_id === "string" ? row.data_id : undefined,
    ludocid: typeof row.ludocid === "string" ? row.ludocid : undefined,
    hours: row.hours ?? row.operating_hours,
  };
}

export async function searchGoogleMapsBusinesses(query: string, opts?: {
  country?: string;
  language?: string;
  location?: string;
}): Promise<GoogleMapsSearchResult[]> {
  const raw = await scrapingDogGet("/google_maps", {
    query,
    country: opts?.country ?? "us",
    language: opts?.language ?? "en",
    location: opts?.location,
    type: "search",
  });
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { results?: unknown }).results)
      ? (raw as { results: unknown[] }).results
      : Array.isArray((raw as { data?: unknown }).data)
        ? (raw as { data: unknown[] }).data
        : [];
  return rows
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map(normalizeSearchRow);
}

export async function getGoogleMapsPlaceDetails(identifier: {
  placeId?: string;
  dataId?: string;
  ludocid?: string;
}): Promise<Record<string, unknown>> {
  const raw = await scrapingDogGet("/google_maps/places", {
    place_id: identifier.placeId,
    data_id: identifier.dataId,
    ludocid: identifier.ludocid,
  });
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return { raw };
}

export async function scrapingDogScrapePage(
  targetUrl: string,
  dynamic: boolean,
): Promise<string> {
  const raw = await scrapingDogGet("/scrape", {
    url: targetUrl,
    dynamic: dynamic ? "true" : "false",
  });
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const html = (raw as { html?: string; body?: string }).html ?? (raw as { body?: string }).body;
    if (typeof html === "string") return html;
  }
  return JSON.stringify(raw);
}
