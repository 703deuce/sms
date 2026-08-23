import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";

/** ~0.1 m precision — matches typical Maps @lat,lng URLs and Local Falcon grid pins */
export function formatMapsCoordinate(lat: number, lng: number, zoom: number): string {
  return `@${lat.toFixed(6)},${lng.toFixed(6)},${zoom}z`;
}

export type BrightDataDeviceProfile = Pick<ScanDeviceProfile, "device" | "os" | "browser">;

/** Map scan profile → Bright Data `brd_mobile` (defaults to desktop when omitted). */
export function brightDataMobileParam(profile: BrightDataDeviceProfile): string {
  if (profile.device === "desktop") return "0";
  if (profile.os === "ios") return "ios";
  if (profile.os === "android") return "android";
  return "1";
}

/** Map scan profile → Bright Data `brd_browser`. */
export function brightDataBrowserParam(profile: BrightDataDeviceProfile): string | null {
  if (profile.browser === "firefox") {
    if (profile.device === "mobile") return null;
    return "firefox";
  }
  if (profile.browser === "chrome") return "chrome";
  return null;
}

export function appendBrightDataDeviceParams(
  url: string,
  profile: BrightDataDeviceProfile
): string {
  const params = new URLSearchParams();
  params.set("brd_mobile", brightDataMobileParam(profile));
  const browser = brightDataBrowserParam(profile);
  if (browser) params.set("brd_browser", browser);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.toString()}`;
}

export function brightDataMapsUseMobileParams(): boolean {
  return process.env.BRIGHTDATA_MAPS_MOBILE === "true";
}

export function buildBrightDataMapsUrl(params: {
  keyword: string;
  lat: number;
  lng: number;
  zoom?: number;
  device?: ScanDeviceProfile["device"];
  os?: ScanDeviceProfile["os"];
  browser?: ScanDeviceProfile["browser"];
}): string {
  const kw = params.keyword.trim();
  const q = encodeURIComponent(kw).replace(/%20/g, "+");
  const zoom = params.zoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const ll = formatMapsCoordinate(params.lat, params.lng, zoom);
  const gl = LOCAL_FALCON_PARITY.countryCode.toLowerCase();
  const hl = LOCAL_FALCON_PARITY.languageCode;

  let url = `https://www.google.com/maps/search/${q}/${ll}?brd_json=1&gl=${gl}&hl=${hl}`;

  // Bright Data SERP REST API returns empty/502 for Maps + brd_mobile — opt-in only.
  if (brightDataMapsUseMobileParams() && params.device) {
    url = appendBrightDataDeviceParams(url, {
      device: params.device,
      os: params.os ?? (params.device === "mobile" ? "android" : "windows"),
      browser: params.browser ?? "chrome",
    });
  }

  return url;
}
