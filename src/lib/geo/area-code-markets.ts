/** Metro / region slug → likely local area codes for merchandising (not exact geolocation). */
export const METRO_AREA_CODES: Record<string, string[]> = {
  "northern-virginia": ["571", "703"],
  "washington-dc": ["202", "771"],
  "maryland-dc-suburbs": ["301", "240"],
  fredericksburg: ["540"],
  miami: ["305", "786"],
  orlando: ["689", "407"],
  atlanta: ["404", "470", "678"],
  houston: ["713", "281", "832"],
  dallas: ["214", "469", "972"],
  "new-york-city": ["212", "917", "929", "347", "646"],
  "los-angeles": ["213", "323", "310", "424"],
  pasadena: ["626"],
  chicago: ["312", "773", "872"],
  boston: ["617", "857"],
  philadelphia: ["215", "267"],
  phoenix: ["602", "480", "623"],
  denver: ["303", "720"],
  seattle: ["206", "425"],
  "san-francisco": ["415", "628"],
  "san-diego": ["619", "858"],
};

/** US state/region code → default metro slug when city lookup fails. */
export const REGION_DEFAULT_METRO: Record<string, string> = {
  VA: "northern-virginia",
  DC: "washington-dc",
  MD: "maryland-dc-suburbs",
  FL: "miami",
  GA: "atlanta",
  TX: "houston",
  NY: "new-york-city",
  CA: "los-angeles",
  IL: "chicago",
  MA: "boston",
  PA: "philadelphia",
  AZ: "phoenix",
  CO: "denver",
  WA: "seattle",
};

export const DEFAULT_MARKET_SLUG = "northern-virginia";

export function areaCodesForMarketSlug(slug: string): string[] {
  return METRO_AREA_CODES[slug] ?? METRO_AREA_CODES[DEFAULT_MARKET_SLUG] ?? ["571", "703"];
}

export function marketSlugFromGeo(input: {
  country?: string | null;
  region?: string | null;
  city?: string | null;
}): { slug: string; likelyAreaCodes: string[]; confidence: "high" | "medium" | "low" } {
  const country = (input.country ?? "").toUpperCase();
  if (country && country !== "US") {
    return {
      slug: DEFAULT_MARKET_SLUG,
      likelyAreaCodes: areaCodesForMarketSlug(DEFAULT_MARKET_SLUG),
      confidence: "low",
    };
  }

  const region = (input.region ?? "").toUpperCase();
  const city = (input.city ?? "").toLowerCase();

  if (city.includes("miami") || city.includes("hialeah")) {
    return { slug: "miami", likelyAreaCodes: areaCodesForMarketSlug("miami"), confidence: "high" };
  }
  if (city.includes("arlington") || city.includes("alexandria") || city.includes("fairfax")) {
    return {
      slug: "northern-virginia",
      likelyAreaCodes: areaCodesForMarketSlug("northern-virginia"),
      confidence: "high",
    };
  }
  if (city.includes("washington")) {
    return {
      slug: "washington-dc",
      likelyAreaCodes: areaCodesForMarketSlug("washington-dc"),
      confidence: "high",
    };
  }
  if (city.includes("pasadena")) {
    return { slug: "pasadena", likelyAreaCodes: areaCodesForMarketSlug("pasadena"), confidence: "high" };
  }
  if (city.includes("new york") || city.includes("brooklyn") || city.includes("queens")) {
    return {
      slug: "new-york-city",
      likelyAreaCodes: areaCodesForMarketSlug("new-york-city"),
      confidence: "high",
    };
  }

  const metro = REGION_DEFAULT_METRO[region] ?? DEFAULT_MARKET_SLUG;
  return {
    slug: metro,
    likelyAreaCodes: areaCodesForMarketSlug(metro),
    confidence: region ? "medium" : "low",
  };
}
