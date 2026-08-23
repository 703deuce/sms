import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { mapsSearchAtCoordinate, type BrightDataOrganicItem } from "@/lib/providers/brightdata/index";
import {
  BrightDataMapsFailure,
  humanMessageForCategory,
} from "@/lib/providers/brightdata/failure-diagnostics";
import {
  buildBrightDataMapsUrl,
  formatMapsCoordinate,
} from "@/lib/providers/brightdata/url";

export function mapsGridDepth(): number {
  const n = Number(
    process.env.BRIGHTDATA_MAPS_DEPTH ??
      process.env.SCRAPINGDOG_MAPS_DEPTH ??
      LOCAL_FALCON_PARITY.gridDepth
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export type BrightDataMapsGridRequest = {
  endpoint: string;
  provider: "brightdata";
  zone: string;
  url: string;
  query: string;
  ll: string;
  depth: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  gl: string;
  hl: string;
  _meta: {
    location_zoom: number;
    scan_profile: Pick<ScanDeviceProfile, "device" | "os" | "browser">;
    note: string;
  };
};

export function buildBrightDataMapsGridRequest(params: {
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth?: number;
  zoom?: number;
  zone?: string;
}): BrightDataMapsGridRequest {
  const depth = params.depth ?? mapsGridDepth();
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const kw = params.keyword.trim();
  const ll = formatMapsCoordinate(params.lat, params.lng, zoom);
  const zone = params.zone ?? process.env.BRIGHTDATA_ZONE ?? process.env.BRIGHTDATA_SERP_ZONE ?? "";

  const url = buildBrightDataMapsUrl({
    keyword: kw,
    lat: params.lat,
    lng: params.lng,
    zoom,
    device: params.device,
    os: params.os,
    browser: params.browser,
  });

  return {
    endpoint: "https://api.brightdata.com/request",
    provider: "brightdata",
    zone,
    url,
    query: kw,
    ll,
    depth,
    device: params.device,
    os: params.os,
    browser: params.browser,
    gl: LOCAL_FALCON_PARITY.countryCode.toLowerCase(),
    hl: LOCAL_FALCON_PARITY.languageCode,
    _meta: {
      location_zoom: zoom,
      scan_profile: { device: params.device, os: params.os, browser: params.browser },
      note: "SERP API Maps — 6-decimal @lat,lng,17z; brd_mobile only when BRIGHTDATA_MAPS_MOBILE=true",
    },
  };
}

export function normalizeBrightDataResults(
  items: BrightDataOrganicItem[],
  depth: number
): MapsLiveResult[] {
  const sorted = [...items].sort((a, b) => {
    const ra = a.global_rank ?? a.rank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.global_rank ?? b.rank ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });

  return sorted.slice(0, depth).map((item, idx) => ({
    rank_group: item.global_rank ?? item.rank ?? idx + 1,
    rank_absolute: item.global_rank ?? item.rank ?? idx + 1,
    title: item.title,
    place_id: item.map_id_encoded,
    cid: item.map_id ?? item.fid,
    rating:
      item.rating != null
        ? { value: item.rating, votes_count: item.reviews_cnt }
        : undefined,
    category: Array.isArray(item.category)
      ? item.category.map((c) => c.title_short ?? c.title).filter(Boolean).join(", ")
      : undefined,
    address: item.address,
    phone: item.phone,
    url: item.link,
    latitude: item.latitude,
    longitude: item.longitude,
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
  request: BrightDataMapsGridRequest;
  timestamp: string;
}> {
  const depth = params.depth ?? mapsGridDepth();
  const request = buildBrightDataMapsGridRequest(params);

  const raw = await mapsSearchAtCoordinate({
    keyword: request.query,
    lat: params.lat,
    lng: params.lng,
    zoom: request._meta.location_zoom,
    device: params.device,
    os: params.os,
    browser: params.browser,
    organizationId: params.organizationId,
  });

  const items = normalizeBrightDataResults(raw, depth);
  if (!items.length) {
    throw new BrightDataMapsFailure(
      {
        category: "empty_maps_results",
        organicCount: 0,
        providerErrorMessage: "normalizeBrightDataResults yielded zero items",
      },
      humanMessageForCategory("empty_maps_results")
    );
  }

  return {
    items,
    request,
    timestamp: new Date().toISOString(),
  };
}
