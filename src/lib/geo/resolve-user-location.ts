import { marketSlugFromGeo, metroDisplayName, areaCodesForMarketSlug } from "@/lib/geo/area-code-markets";
import { normalizeUsRegion } from "@/lib/geo/us-states";

export type ResolvedUserLocation = {
  marketSlug: string;
  metroLabel: string;
  likelyAreaCodes: string[];
  city: string | null;
  region: string | null;
  source: "browser" | "city_or_zip";
};

/** National/generic shelf — not tied to visitor IP. */
export const GENERIC_TOP_PICKS_MARKET = {
  marketSlug: "generic",
  metroLabel: "Popular nationwide",
  likelyAreaCodes: ["212", "305", "713", "571", "415", "404"],
} as const;

async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; region?: string }> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "TransovoNumbersLanding/1.0" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    address?: { city?: string; town?: string; village?: string; state?: string };
  };
  const city = data.address?.city ?? data.address?.town ?? data.address?.village;
  const region = data.address?.state;
  return { city, region };
}

async function geocodeCityOrZip(input: string): Promise<{ city?: string; region?: string }> {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const zipMatch = trimmed.match(/^\d{5}$/);
  if (zipMatch) {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zipMatch[0]}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          places?: { "place name"?: string; "state abbreviation"?: string }[];
        };
        const place = data.places?.[0];
        if (place) {
          return {
            city: place["place name"],
            region: place["state abbreviation"],
          };
        }
      }
    } catch {
      /* fall through to nominatim */
    }
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmed.includes(",") ? trimmed : `${trimmed}, USA`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "TransovoNumbersLanding/1.0" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return {};
  const results = (await res.json()) as { display_name?: string }[];
  const hit = results[0]?.display_name;
  if (!hit) return {};

  const parts = hit.split(",").map((p) => p.trim());
  const city = parts[0];
  const regionPart = parts.find((p) => normalizeUsRegion(p).length === 2);
  return { city, region: regionPart ?? parts[1] };
}

export async function resolveUserLocation(input: {
  lat?: number;
  lng?: number;
  cityOrZip?: string;
  source: "browser" | "city_or_zip";
}): Promise<ResolvedUserLocation> {
  let city: string | undefined;
  let region: string | undefined;

  if (input.lat != null && input.lng != null) {
    const geo = await reverseGeocode(input.lat, input.lng);
    city = geo.city;
    region = geo.region;
  } else if (input.cityOrZip?.trim()) {
    const geo = await geocodeCityOrZip(input.cityOrZip);
    city = geo.city;
    region = geo.region;
  }

  if (!city && !region) {
    throw new Error("Could not find that city or ZIP. Try another location.");
  }

  const mapped = marketSlugFromGeo({
    country: "US",
    city,
    region,
  });

  return {
    marketSlug: mapped.slug,
    metroLabel: city ? `${city}${region ? `, ${normalizeUsRegion(region)}` : ""}` : metroDisplayName(mapped.slug),
    likelyAreaCodes: mapped.likelyAreaCodes,
    city: city ?? null,
    region: region ? normalizeUsRegion(region) : null,
    source: input.source,
  };
}

export function genericTopPicksMarket() {
  return {
    marketSlug: GENERIC_TOP_PICKS_MARKET.marketSlug,
    metroLabel: GENERIC_TOP_PICKS_MARKET.metroLabel,
    likelyAreaCodes: [...GENERIC_TOP_PICKS_MARKET.likelyAreaCodes],
    localized: false as const,
  };
}
