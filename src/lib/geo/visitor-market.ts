import { getTrustedClientIp } from "@/lib/http/client-ip";
import {
  DEFAULT_MARKET_SLUG,
  areaCodesForMarketSlug,
  marketSlugFromGeo,
} from "@/lib/geo/area-code-markets";

export type VisitorMarket = {
  country: string;
  region: string | null;
  metro: string;
  marketSlug: string;
  likelyAreaCodes: string[];
  confidence: "high" | "medium" | "low";
};

const geoCache = new Map<string, { market: VisitorMarket; expiresAt: number }>();
const GEO_CACHE_TTL_MS = 60 * 60 * 1000;

function defaultMarket(): VisitorMarket {
  return {
    country: "US",
    region: "VA",
    metro: "Northern Virginia",
    marketSlug: DEFAULT_MARKET_SLUG,
    likelyAreaCodes: areaCodesForMarketSlug(DEFAULT_MARKET_SLUG),
    confidence: "low",
  };
}

async function lookupIpGeo(ip: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
}> {
  const token = process.env.IPINFO_TOKEN?.trim();
  if (token) {
    try {
      const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}?token=${token}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          country?: string;
          region?: string;
          city?: string;
        };
        return data;
      }
    } catch {
      // fall through
    }
  }

  return {};
}

export async function getVisitorMarket(request: Request): Promise<VisitorMarket> {
  const ip = getTrustedClientIp(request);
  if (!ip || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return defaultMarket();
  }

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.market;
  }

  const geo = await lookupIpGeo(ip);
  const mapped = marketSlugFromGeo(geo);

  const market: VisitorMarket = {
    country: (geo.country ?? "US").toUpperCase(),
    region: geo.region ?? null,
    metro: mapped.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    marketSlug: mapped.slug,
    likelyAreaCodes: mapped.likelyAreaCodes,
    confidence: mapped.confidence,
  };

  geoCache.set(ip, { market, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
  return market;
}
