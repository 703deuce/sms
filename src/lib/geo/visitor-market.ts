import { getTrustedClientIp } from "@/lib/http/client-ip";
import {
  DEFAULT_MARKET_SLUG,
  areaCodesForMarketSlug,
  marketSlugFromGeo,
  metroDisplayName,
} from "@/lib/geo/area-code-markets";

export type VisitorMarket = {
  country: string;
  region: string | null;
  city: string | null;
  metro: string;
  marketSlug: string;
  likelyAreaCodes: string[];
  confidence: "high" | "medium" | "low";
  geoSource: "ipinfo" | "ip-api" | "default";
};

const geoCache = new Map<string, { market: VisitorMarket; expiresAt: number }>();
const GEO_CACHE_TTL_MS = 60 * 60 * 1000;

type GeoLookup = {
  country?: string;
  region?: string;
  city?: string;
};

function defaultMarket(): VisitorMarket {
  return {
    country: "US",
    region: null,
    city: null,
    metro: metroDisplayName(DEFAULT_MARKET_SLUG),
    marketSlug: DEFAULT_MARKET_SLUG,
    likelyAreaCodes: areaCodesForMarketSlug(DEFAULT_MARKET_SLUG),
    confidence: "low",
    geoSource: "default",
  };
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

async function lookupIpInfo(ip: string): Promise<GeoLookup> {
  const token = process.env.IPINFO_TOKEN?.trim();
  if (!token) return {};

  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}?token=${token}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return {};
    return (await res.json()) as GeoLookup;
  } catch {
    return {};
  }
}

/** Free fallback when IPinfo is unavailable. Server-side HTTP only. */
async function lookupIpApi(ip: string): Promise<GeoLookup> {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,region,city`,
      { cache: "no-store", signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      status?: string;
      countryCode?: string;
      region?: string;
      regionName?: string;
      city?: string;
    };
    if (data.status !== "success") return {};
    return {
      country: data.countryCode,
      region: data.region ?? data.regionName,
      city: data.city,
    };
  } catch {
    return {};
  }
}

function buildMarket(geo: GeoLookup, source: VisitorMarket["geoSource"]): VisitorMarket {
  const mapped = marketSlugFromGeo(geo);
  return {
    country: (geo.country ?? "US").toUpperCase(),
    region: geo.region ?? null,
    city: geo.city ?? null,
    metro: metroDisplayName(mapped.slug),
    marketSlug: mapped.slug,
    likelyAreaCodes: mapped.likelyAreaCodes,
    confidence: mapped.confidence,
    geoSource: source,
  };
}

export async function getVisitorMarket(request: Request): Promise<VisitorMarket> {
  const ip = getTrustedClientIp(request);
  if (!ip || isPrivateIp(ip)) {
    return defaultMarket();
  }

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.market;
  }

  let geo = await lookupIpInfo(ip);
  let source: VisitorMarket["geoSource"] = "ipinfo";

  if (!geo.country && !geo.region && !geo.city) {
    geo = await lookupIpApi(ip);
    source = "ip-api";
  }

  const market =
    !geo.country && !geo.region && !geo.city ? defaultMarket() : buildMarket(geo, source);

  geoCache.set(ip, { market, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
  return market;
}
