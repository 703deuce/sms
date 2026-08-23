import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { minCellSerpResults } from "@/lib/maps/cell-result-integrity";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { mapsSearchAtCoordinate, type MapsSearchResult } from "@/lib/providers/scrapingdog/index";

export function mapsGridDepth(): number {
  const n = Number(
    process.env.SCRAPINGDOG_MAPS_DEPTH ??
      process.env.DATAFORSEO_MAPS_DEPTH ??
      LOCAL_FALCON_PARITY.gridDepth
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export type MapsGridRequest = {
  endpoint: string;
  query: string;
  ll: string;
  domain: string;
  language: string;
  country: string;
  depth: number;
  search_engine: "google_maps";
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  _meta: {
    provider: "scrapingdog";
    location_zoom: number;
    scan_profile: Pick<ScanDeviceProfile, "device" | "os" | "browser">;
    note: string;
  };
};

/** ScrapingDog docs: ll=@latitude,longitude,zoomz (e.g. @40.74,-74.00,15.1z). */
function formatScrapingDogLl(lat: number, lng: number, zoom: number): string {
  const z = Number.isFinite(zoom) ? Math.min(30, Math.max(3, zoom)) : 17;
  const latR = Math.round(lat * 1e7) / 1e7;
  const lngR = Math.round(lng * 1e7) / 1e7;
  return `@${latR},${lngR},${z}z`;
}

export function buildMapsGridRequest(params: {
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth?: number;
  zoom?: number;
}): MapsGridRequest {
  const depth = params.depth ?? mapsGridDepth();
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const kw = params.keyword.trim();

  return {
    endpoint: "https://api.scrapingdog.com/google_maps",
    query: kw,
    ll: formatScrapingDogLl(params.lat, params.lng, zoom),
    domain: LOCAL_FALCON_PARITY.seDomain,
    language: LOCAL_FALCON_PARITY.languageCode,
    country: LOCAL_FALCON_PARITY.countryCode.toLowerCase(),
    depth,
    search_engine: "google_maps",
    device: params.device,
    os: params.os,
    browser: params.browser,
    _meta: {
      provider: "scrapingdog",
      location_zoom: zoom,
      scan_profile: { device: params.device, os: params.os, browser: params.browser },
      note: "ScrapingDog google_maps uses query+ll (not DataForSEO location_coordinate)",
    },
  };
}

export function normalizeScrapingDogResults(
  items: MapsSearchResult[],
  depth: number
): MapsLiveResult[] {
  return items.slice(0, depth).map((item, idx) => ({
    rank_group: idx + 1,
    rank_absolute: idx + 1,
    title: item.title,
    place_id: item.place_id,
    cid: item.data_id,
    rating:
      item.rating != null
        ? { value: item.rating, votes_count: item.reviews }
        : undefined,
    category: item.type,
    address: item.address,
    phone: item.phone,
    url: item.website,
    latitude: item.gps_coordinates?.latitude,
    longitude: item.gps_coordinates?.longitude,
  }));
}

export async function mapsGridCell(params: {
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth?: number;
  zoom?: number;
  organizationId?: string;
}): Promise<{
  items: MapsLiveResult[];
  request: MapsGridRequest;
  timestamp: string;
}> {
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error("ScrapingDog grid cell requires finite lat/lng");
  }

  const depth = params.depth ?? mapsGridDepth();
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const request = buildMapsGridRequest({ ...params, zoom });

  // Always pin the search with ll=@lat,lng,zoomz (required for grid rank).
  const raw = await mapsSearchAtCoordinate({
    query: request.query,
    lat: params.lat,
    lng: params.lng,
    zoom,
    domain: request.domain,
    language: request.language,
    country: request.country,
    organizationId: params.organizationId,
  });

  const items = normalizeScrapingDogResults(raw, depth);
  if (!items.length) {
    throw new Error("ScrapingDog returned no map results for this cell");
  }
  const minSerp = minCellSerpResults(depth);
  if (items.length < minSerp) {
    throw new Error(
      `sparse SERP: ${items.length} results returned (need ${minSerp})`
    );
  }

  return {
    items,
    request,
    timestamp: new Date().toISOString(),
  };
}
