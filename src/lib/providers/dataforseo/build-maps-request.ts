import {
  LOCAL_FALCON_PARITY,
} from "@/lib/maps/local-falcon-parity";
import {
  MAPS_LANGUAGE,
  MAPS_LIVE_ENDPOINT,
  type ScanDeviceProfile,
} from "@/lib/maps/scan-profiles";
import { mapsDepthDefault } from "@/lib/providers/dataforseo/index";

export type MapsLiveRequestPayload = {
  keyword: string;
  location_coordinate: string;
  language_code: string;
  device: string;
  os: string;
  depth: number;
  search_this_area: boolean;
  search_places: boolean;
  se_domain: string;
  /** Metadata for debug / parity UI (not sent to DataForSEO) */
  _meta: {
    endpoint: string;
    search_engine: string;
    lat: number;
    lng: number;
    zoom: number;
    personalization: string;
    browser: string;
    country_code: string;
    search_this_area_fallback?: boolean;
  };
};

/** DataForSEO docs: max 7 decimal digits for lat/lng in location_coordinate. */
function roundCoord(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

/**
 * DataForSEO Maps Live Advanced requires:
 *   location_coordinate = "latitude,longitude,zoom" with zoom like `17z`
 * (see docs.dataforseo.com serp/google/maps/live/advanced).
 */
export function formatMapsLocationCoordinate(lat: number, lng: number, zoom: number): string {
  const z = Number.isFinite(zoom) ? Math.min(21, Math.max(3, Math.round(zoom))) : 17;
  return `${roundCoord(lat)},${roundCoord(lng)},${z}z`;
}

export function buildMapsLiveRequest(params: {
  keyword: string;
  lat: number;
  lng: number;
  profile: Pick<ScanDeviceProfile, "device" | "os" | "browser">;
  depth?: number;
  languageCode?: string;
  zoom?: number;
  searchThisArea?: boolean;
  searchPlaces?: boolean;
  seDomain?: string;
  usedSearchThisAreaFallback?: boolean;
}): MapsLiveRequestPayload {
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const depth = Math.min(params.depth ?? mapsDepthDefault(), 100);
  const keyword = params.keyword.trim();
  const lat = roundCoord(params.lat);
  const lng = roundCoord(params.lng);

  return {
    keyword,
    location_coordinate: formatMapsLocationCoordinate(lat, lng, zoom),
    language_code: params.languageCode ?? LOCAL_FALCON_PARITY.languageCode ?? MAPS_LANGUAGE,
    device: params.profile.device,
    os: params.profile.os,
    depth,
    search_this_area: params.searchThisArea ?? LOCAL_FALCON_PARITY.searchThisArea,
    search_places: params.searchPlaces ?? LOCAL_FALCON_PARITY.searchPlaces,
    se_domain: params.seDomain ?? LOCAL_FALCON_PARITY.seDomain,
    _meta: {
      endpoint: MAPS_LIVE_ENDPOINT,
      search_engine: LOCAL_FALCON_PARITY.searchEngine,
      lat,
      lng,
      zoom,
      personalization: "none",
      browser: params.profile.browser,
      country_code: LOCAL_FALCON_PARITY.countryCode,
      search_this_area_fallback: params.usedSearchThisAreaFallback,
    },
  };
}

/** Body sent to DataForSEO (without _meta) */
export function mapsLiveRequestBody(payload: MapsLiveRequestPayload) {
  const { _meta: _, ...body } = payload;
  return body;
}
