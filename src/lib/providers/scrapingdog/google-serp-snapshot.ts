import { logProviderRun } from "@/lib/providers/dataforseo";
import { mapsGridCell } from "@/lib/providers/brightdata/maps-grid";
import { myBusinessInfo, type MapsLiveResult } from "@/lib/providers/dataforseo";

export type MapPackEntry = {
  position: number;
  title: string;
  rating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
  phone?: string | null;
  placeId?: string | null;
};

export type OrganicSerpEntry = {
  position: number;
  title: string;
  url?: string | null;
  snippet?: string | null;
  domain?: string | null;
};

export type GoogleSerpSnapshot = {
  keyword: string;
  location: string | null;
  mapPack: MapPackEntry[];
  organic: OrganicSerpEntry[];
};

const MAP_PACK_DEPTH = 10;

function isBrightDataConfigured(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_KEY?.trim());
}

function getScrapingDogApiKey(): string | null {
  return process.env.SCRAPINGDOG_API_KEY?.trim() ?? process.env.SCRAPING_DOG_API_KEY?.trim() ?? null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function parseLocationParts(location: string): { city: string; state: string } | null {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { city: parts[0], state: parts[1] };
}

function mapsLiveResultToEntry(item: MapsLiveResult, fallbackPosition: number): MapPackEntry | null {
  const title = str(item.title);
  if (!title) return null;
  const position =
    typeof item.rank_absolute === "number"
      ? item.rank_absolute
      : typeof item.rank_group === "number"
        ? item.rank_group
        : fallbackPosition;
  return {
    position,
    title,
    rating: item.rating?.value ?? null,
    reviewCount: item.rating?.votes_count ?? null,
    address: str(item.address) || null,
    phone: str(item.phone) || null,
    placeId: str(item.place_id) || null,
  };
}

async function resolveSearchCoordinates(params: {
  lat?: number | null;
  lng?: number | null;
  location?: string | null;
  organizationId?: string;
}): Promise<{ lat: number; lng: number } | null> {
  if (params.lat != null && params.lng != null) {
    return { lat: params.lat, lng: params.lng };
  }

  const location = params.location?.trim();
  if (!location) return null;

  const parts = parseLocationParts(location);
  if (!parts) return null;

  try {
    const items = await myBusinessInfo({
      keyword: parts.city,
      city: parts.city,
      state: parts.state,
      country: "United States",
      organizationId: params.organizationId,
    });
    const hit = items[0];
    if (hit?.latitude != null && hit?.longitude != null) {
      return { lat: hit.latitude, lng: hit.longitude };
    }
  } catch {
    /* fall through */
  }

  return null;
}

function isRelevantForKeyword(item: MapsLiveResult, keyword: string): boolean {
  const blob = `${item.title ?? ""} ${item.category ?? ""} ${(item.additional_categories ?? []).join(" ")}`.toLowerCase();

  if (/\b(towing|moving and storage|moving service|movers?)\b/i.test(blob) && !/\bjunk\b/i.test(blob)) {
    return false;
  }

  const terms = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3 && !/woodbridge|virginia|near|local/.test(t));

  if (!terms.length) return true;
  return terms.some((t) => blob.includes(t));
}

/** Top-10 map pack via BrightData Maps SERP (same as rank grid / keyword tracker). */
async function fetchMapPackTop10(params: {
  keyword: string;
  lat?: number | null;
  lng?: number | null;
  location?: string | null;
  organizationId?: string;
}): Promise<MapPackEntry[]> {
  if (!isBrightDataConfigured()) return [];

  const coords = await resolveSearchCoordinates(params);
  if (!coords) return [];

  try {
    const live = await mapsGridCell({
      keyword: params.keyword,
      lat: coords.lat,
      lng: coords.lng,
      device: "desktop",
      os: "windows",
      browser: "chrome",
      depth: MAP_PACK_DEPTH,
      organizationId: params.organizationId,
    });

    return live.items
      .filter((item) => isRelevantForKeyword(item, params.keyword))
      .map((item, i) => mapsLiveResultToEntry(item, i + 1))
      .filter((e): e is MapPackEntry => e != null)
      .slice(0, MAP_PACK_DEPTH);
  } catch {
    return [];
  }
}

function parseRating(raw: unknown): number | null {
  const s = str(raw);
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

function parseReviewCount(raw: unknown): number | null {
  const s = str(raw).replace(/,/g, "");
  const m = s.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function parseOrganic(raw: Record<string, unknown>): OrganicSerpEntry[] {
  const list = raw.organic_results ?? raw.results;
  if (!Array.isArray(list)) return [];

  return list
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((r, i) => {
      const url = str(r.link ?? r.url) || null;
      return {
        position: typeof r.position === "number" ? r.position : i + 1,
        title: str(r.title),
        url,
        snippet: str(r.snippet ?? r.description) || null,
        domain: url ? hostFromUrl(url) : null,
      };
    })
    .filter((e) => e.title.length > 0)
    .slice(0, MAP_PACK_DEPTH);
}

export function isGoogleSerpConfigured(): boolean {
  return Boolean(getScrapingDogApiKey() || isBrightDataConfigured());
}

export async function fetchGoogleSerpSnapshot(params: {
  keyword: string;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  organizationId?: string;
}): Promise<GoogleSerpSnapshot | null> {
  const keyword = params.keyword.trim();
  const location = params.location?.trim() || null;
  if (!keyword) return null;

  const scrapingDogKey = getScrapingDogApiKey();
  let organic: OrganicSerpEntry[] = [];

  if (scrapingDogKey) {
    const queryParams: Record<string, string> = {
      query: keyword.slice(0, 200),
      country: "us",
      language: "en",
      results: "10",
    };
    if (location) queryParams.location = location;

    const url = new URL("https://api.scrapingdog.com/google");
    url.searchParams.set("api_key", scrapingDogKey);
    for (const [k, v] of Object.entries(queryParams)) url.searchParams.set(k, v);

    const start = Date.now();
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
    const latencyMs = Date.now() - start;

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "scrapingdog",
      endpoint: "google/serp-snapshot-organic",
      request: queryParams,
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (res.ok) {
      organic = parseOrganic(data);
    }
  }

  let mapPack: MapPackEntry[] = [];
  try {
    mapPack = await fetchMapPackTop10({
      keyword,
      lat: params.lat,
      lng: params.lng,
      location,
      organizationId: params.organizationId,
    });
  } catch {
    mapPack = [];
  }

  if (!mapPack.length && !organic.length) return null;

  return {
    keyword,
    location,
    mapPack,
    organic,
  };
}
