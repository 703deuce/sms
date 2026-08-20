import { normalizeUsRegion } from "@/lib/geo/us-states";

export const METRO_AREA_CODES: Record<string, string[]> = {
  "northern-virginia": ["571", "703"],
  "washington-dc": ["202", "771"],
  "maryland-dc-suburbs": ["301", "240"],
  fredericksburg: ["540"],
  miami: ["305", "786"],
  orlando: ["689", "407"],
  tampa: ["813", "656"],
  jacksonville: ["904"],
  atlanta: ["404", "470", "678"],
  houston: ["713", "281", "832"],
  dallas: ["214", "469", "972"],
  "san-antonio": ["210", "726"],
  austin: ["512", "737"],
  "new-york-city": ["212", "917", "929", "347", "646"],
  "los-angeles": ["213", "323", "310", "424"],
  "san-francisco": ["415", "628"],
  "san-diego": ["619", "858"],
  "san-jose": ["408", "669"],
  pasadena: ["626"],
  chicago: ["312", "773", "872"],
  boston: ["617", "857"],
  philadelphia: ["215", "267"],
  phoenix: ["602", "480", "623"],
  denver: ["303", "720"],
  seattle: ["206", "425"],
  portland: ["503", "971"],
  "las-vegas": ["702", "725"],
  nashville: ["615", "629"],
  charlotte: ["704", "980"],
  raleigh: ["919", "984"],
  detroit: ["313", "248"],
  minneapolis: ["612", "651"],
  "kansas-city": ["816", "975"],
  "st-louis": ["314", "557"],
  columbus: ["614", "380"],
  cleveland: ["216", "440"],
  pittsburgh: ["412", "878"],
  baltimore: ["410", "443"],
  indianapolis: ["317", "463"],
  milwaukee: ["414", "262"],
  "new-orleans": ["504"],
  memphis: ["901"],
  louisville: ["502"],
  "salt-lake-city": ["801", "385"],
  albuquerque: ["505"],
  honolulu: ["808"],
  "birmingham-fallback": ["205", "659"],
};

export const METRO_DISPLAY_NAMES: Record<string, string> = {
  "northern-virginia": "Northern Virginia",
  "washington-dc": "Washington, DC",
  "maryland-dc-suburbs": "Maryland",
  fredericksburg: "Fredericksburg, VA",
  miami: "Miami",
  orlando: "Orlando",
  tampa: "Tampa",
  jacksonville: "Jacksonville",
  atlanta: "Atlanta",
  houston: "Houston",
  dallas: "Dallas",
  "san-antonio": "San Antonio",
  austin: "Austin",
  "new-york-city": "New York City",
  "los-angeles": "Los Angeles",
  "san-francisco": "San Francisco",
  "san-diego": "San Diego",
  "san-jose": "San Jose",
  pasadena: "Pasadena, CA",
  chicago: "Chicago",
  boston: "Boston",
  philadelphia: "Philadelphia",
  phoenix: "Phoenix",
  denver: "Denver",
  seattle: "Seattle",
  portland: "Portland",
  "las-vegas": "Las Vegas",
  nashville: "Nashville",
  charlotte: "Charlotte",
  raleigh: "Raleigh",
  detroit: "Detroit",
  minneapolis: "Minneapolis",
  "kansas-city": "Kansas City",
  "st-louis": "St. Louis",
  columbus: "Columbus",
  cleveland: "Cleveland",
  pittsburgh: "Pittsburgh",
  baltimore: "Baltimore",
  indianapolis: "Indianapolis",
  milwaukee: "Milwaukee",
  "new-orleans": "New Orleans",
  memphis: "Memphis",
  louisville: "Louisville",
  "salt-lake-city": "Salt Lake City",
  albuquerque: "Albuquerque",
  honolulu: "Honolulu",
  "birmingham-fallback": "Birmingham, AL",
};

export const REGION_DEFAULT_METRO: Record<string, string> = {
  AL: "birmingham-fallback",
  AZ: "phoenix",
  CA: "los-angeles",
  CO: "denver",
  DC: "washington-dc",
  FL: "miami",
  GA: "atlanta",
  HI: "honolulu",
  IL: "chicago",
  IN: "indianapolis",
  KS: "kansas-city",
  KY: "louisville",
  LA: "new-orleans",
  MA: "boston",
  MD: "maryland-dc-suburbs",
  MI: "detroit",
  MN: "minneapolis",
  MO: "st-louis",
  NC: "charlotte",
  NJ: "new-york-city",
  NM: "albuquerque",
  NV: "las-vegas",
  NY: "new-york-city",
  OH: "columbus",
  OK: "dallas",
  OR: "portland",
  PA: "philadelphia",
  TN: "nashville",
  TX: "houston",
  UT: "salt-lake-city",
  VA: "northern-virginia",
  WA: "seattle",
  WI: "milwaukee",
};

export const DEFAULT_MARKET_SLUG = "northern-virginia";

export function metroDisplayName(slug: string): string {
  return METRO_DISPLAY_NAMES[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function areaCodesForMarketSlug(slug: string): string[] {
  return METRO_AREA_CODES[slug] ?? METRO_AREA_CODES[DEFAULT_MARKET_SLUG] ?? ["571", "703"];
}

const CITY_RULES: {
  match: (city: string) => boolean;
  slug: string;
}[] = [
  { match: (c) => c.includes("miami") || c.includes("hialeah"), slug: "miami" },
  { match: (c) => c.includes("orlando"), slug: "orlando" },
  { match: (c) => c.includes("tampa"), slug: "tampa" },
  {
    match: (c) =>
      c.includes("arlington") ||
      c.includes("alexandria") ||
      c.includes("fairfax") ||
      c.includes("reston"),
    slug: "northern-virginia",
  },
  { match: (c) => c.includes("washington"), slug: "washington-dc" },
  { match: (c) => c.includes("baltimore"), slug: "baltimore" },
  {
    match: (c) =>
      c.includes("new york") ||
      c.includes("brooklyn") ||
      c.includes("queens") ||
      c.includes("bronx"),
    slug: "new-york-city",
  },
  { match: (c) => c.includes("los angeles"), slug: "los-angeles" },
  { match: (c) => c.includes("san francisco"), slug: "san-francisco" },
  { match: (c) => c.includes("san diego"), slug: "san-diego" },
  { match: (c) => c.includes("san jose"), slug: "san-jose" },
  { match: (c) => c.includes("chicago"), slug: "chicago" },
  { match: (c) => c.includes("houston"), slug: "houston" },
  { match: (c) => c.includes("dallas") || c.includes("fort worth"), slug: "dallas" },
  { match: (c) => c.includes("austin"), slug: "austin" },
  { match: (c) => c.includes("atlanta"), slug: "atlanta" },
  { match: (c) => c.includes("phoenix"), slug: "phoenix" },
  { match: (c) => c.includes("denver"), slug: "denver" },
  { match: (c) => c.includes("seattle"), slug: "seattle" },
  { match: (c) => c.includes("boston"), slug: "boston" },
  { match: (c) => c.includes("philadelphia"), slug: "philadelphia" },
  { match: (c) => c.includes("las vegas"), slug: "las-vegas" },
  { match: (c) => c.includes("nashville"), slug: "nashville" },
  { match: (c) => c.includes("charlotte"), slug: "charlotte" },
  { match: (c) => c.includes("detroit"), slug: "detroit" },
  { match: (c) => c.includes("minneapolis"), slug: "minneapolis" },
];

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

  const city = (input.city ?? "").toLowerCase();
  for (const rule of CITY_RULES) {
    if (rule.match(city)) {
      return {
        slug: rule.slug,
        likelyAreaCodes: areaCodesForMarketSlug(rule.slug),
        confidence: "high",
      };
    }
  }

  const region = normalizeUsRegion(input.region);
  const metro = REGION_DEFAULT_METRO[region] ?? DEFAULT_MARKET_SLUG;
  return {
    slug: metro,
    likelyAreaCodes: areaCodesForMarketSlug(metro),
    confidence: region ? "medium" : "low",
  };
}
