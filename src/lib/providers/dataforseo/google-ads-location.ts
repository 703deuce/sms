import { logProviderRun } from "@/lib/providers/dataforseo";

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

/** Google Ads market levels — volume targeting uses city+state, not neighborhoods. */
export type MarketLevel = "city" | "state" | "country";

export type GoogleAdsLocation = {
  location_code: number;
  location_name: string;
};

export type GoogleAdsMarket = GoogleAdsLocation & {
  level: MarketLevel;
  location_type?: string;
};

export const US_COUNTRY_LOCATION_CODE = 2840;

const CITY_MARKET_TYPES = new Set(["City", "Municipality"]);

type LocationRow = {
  location_code: number;
  location_name: string;
  location_type?: string;
  country_iso_code?: string;
};

let usLocationsCache: LocationRow[] | null = null;
const locationCodeCache = new Map<number, GoogleAdsMarket>();

export class MarketResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketResolutionError";
  }
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!username || !password) throw new Error("DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are required");
  return { username, password };
}

function authHeader(): string {
  const { username, password } = getCredentials();
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

export function expandUsState(state: string | null | undefined): string | null {
  if (!state?.trim()) return null;
  const s = state.trim();
  if (s.length === 2) return US_STATE_NAMES[s.toUpperCase()] ?? null;
  return s;
}

export function parseLocationInput(input: string | null | undefined): { city?: string; state?: string } {
  if (!input?.trim()) return {};
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && /united states/i.test(parts[parts.length - 1] ?? "")) {
    return { city: parts[0], state: parts[1] };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: parts[1] };
  }
  if (parts.length === 1) {
    return { city: parts[0] };
  }
  return {};
}

/** User-facing market field must be city + state (e.g. Woodbridge, VA). */
export function parseCityStateLabel(label: string): { city: string; state: string } {
  const parsed = parseLocationInput(label);
  if (!parsed.city?.trim() || !parsed.state?.trim()) {
    throw new MarketResolutionError("Market must include city and state, e.g. Woodbridge, VA");
  }
  if (!expandUsState(parsed.state)) {
    throw new MarketResolutionError(`Unknown state: ${parsed.state}`);
  }
  return { city: parsed.city.trim(), state: parsed.state.trim() };
}

async function loadUsGoogleAdsLocations(organizationId?: string): Promise<LocationRow[]> {
  if (usLocationsCache) return usLocationsCache;

  const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/locations/us", {
    headers: { Authorization: authHeader() },
  });
  const data = await res.json();
  const task = data.tasks?.[0];

  await logProviderRun({
    organizationId,
    provider: "dataforseo",
    endpoint: "keywords_data/google_ads/locations/us",
    request: {},
    response: { status_code: task?.status_code, result_count: task?.result_count },
    statusCode: res.status,
    latencyMs: 0,
  });

  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(task.status_message ?? `Location list error ${task.status_code}`);
  }

  usLocationsCache = (task?.result ?? []) as LocationRow[];
  return usLocationsCache;
}

function toMarket(row: LocationRow, level: MarketLevel): GoogleAdsMarket {
  const market: GoogleAdsMarket = {
    location_code: row.location_code,
    location_name: row.location_name,
    level,
    location_type: row.location_type,
  };
  locationCodeCache.set(row.location_code, market);
  return market;
}

function findExactCityMarket(rows: LocationRow[], locationName: string): LocationRow | undefined {
  const exact =
    rows.find((r) => r.location_name === locationName) ??
    rows.find((r) => r.location_name.toLowerCase() === locationName.toLowerCase());
  if (!exact) return undefined;
  if (CITY_MARKET_TYPES.has(exact.location_type ?? "")) return exact;
  return undefined;
}

function fuzzyFindCityMarket(rows: LocationRow[], city: string, stateFull: string): LocationRow | undefined {
  const cityNorm = city.toLowerCase().replace(/\./g, "").trim();
  const stateNorm = stateFull.toLowerCase();

  const candidates = rows.filter((r) => {
    if (r.country_iso_code && r.country_iso_code !== "US") return false;
    if (!CITY_MARKET_TYPES.has(r.location_type ?? "")) return false;
    const parts = r.location_name.split(",").map((p) => p.trim().toLowerCase());
    if (parts[0] !== cityNorm && !parts[0]?.startsWith(cityNorm)) return false;
    return parts.some((p) => p === stateNorm);
  });

  return candidates[0];
}

async function lookupByCode(code: number, organizationId?: string): Promise<GoogleAdsMarket | null> {
  const cached = locationCodeCache.get(code);
  if (cached) return cached;

  const rows = await loadUsGoogleAdsLocations(organizationId);
  const match = rows.find((r) => r.location_code === code);
  if (!match) return null;

  let level: MarketLevel = "country";
  if (match.location_code === US_COUNTRY_LOCATION_CODE) level = "country";
  else if (match.location_name.endsWith(",United States") && !match.location_name.includes(",")) level = "state";
  else if (CITY_MARKET_TYPES.has(match.location_type ?? "")) level = "city";
  else if (match.location_type === "State") level = "state";
  else level = "city";

  return toMarket(match, level);
}

/**
 * Resolve a Google Ads city+state market for search volume.
 * Neighborhoods are intentionally excluded — users put those in the keyword text.
 */
export async function resolveCityStateMarket(params: {
  city: string;
  state: string;
  organizationId?: string;
  strict?: boolean;
}): Promise<GoogleAdsMarket> {
  const city = params.city.trim();
  const stateFull = expandUsState(params.state);
  if (!city || !stateFull) {
    if (params.strict) {
      throw new MarketResolutionError("City and state are required for local keyword volume.");
    }
    return {
      location_code: US_COUNTRY_LOCATION_CODE,
      location_name: "United States",
      level: "country",
    };
  }

  const canonical = `${city},${stateFull},United States`;
  const rows = await loadUsGoogleAdsLocations(params.organizationId);

  const exact = findExactCityMarket(rows, canonical);
  if (exact) return toMarket(exact, "city");

  const fuzzy = fuzzyFindCityMarket(rows, city, stateFull);
  if (fuzzy) return toMarket(fuzzy, "city");

  const stateRow = rows.find((r) => r.location_name === `${stateFull},United States` && r.location_type === "State");
  if (stateRow) {
    if (params.strict) {
      throw new MarketResolutionError(
        `No Google Ads city market found for ${city}, ${stateFull}. Use a nearby city name or check spelling.`
      );
    }
    return toMarket(stateRow, "state");
  }

  if (params.strict) {
    throw new MarketResolutionError(
      `No Google Ads city market found for ${city}, ${stateFull}. Use a nearby city name or check spelling.`
    );
  }

  return {
    location_code: US_COUNTRY_LOCATION_CODE,
    location_name: "United States",
    level: "country",
  };
}

export async function resolveGoogleAdsLocation(params: {
  city?: string | null;
  state?: string | null;
  locationLabel?: string | null;
  locationCode?: number | null;
  organizationId?: string;
  strict?: boolean;
}): Promise<GoogleAdsMarket> {
  if (params.locationCode) {
    const byCode = await lookupByCode(params.locationCode, params.organizationId);
    if (byCode) return byCode;
  }

  const parsed = parseLocationInput(params.locationLabel);
  const city = params.city?.trim() || parsed.city;
  const state = params.state?.trim() || parsed.state;

  if (city && state) {
    return resolveCityStateMarket({
      city,
      state,
      organizationId: params.organizationId,
      strict: params.strict,
    });
  }

  if (params.strict) {
    throw new MarketResolutionError("City and state are required for local keyword volume.");
  }

  return {
    location_code: US_COUNTRY_LOCATION_CODE,
    location_name: "United States",
    level: "country",
  };
}

export function formatGoogleAdsLocationLabel(location: GoogleAdsLocation): string {
  return location.location_name;
}

export function formatMarketDisplay(market: GoogleAdsMarket): string {
  const parts = market.location_name.split(",").map((p) => p.trim());
  if (parts.length >= 2 && parts[parts.length - 1] === "United States") {
    return `${parts[0]}, ${parts[1]}`;
  }
  return market.location_name;
}

export async function resolveGoogleAdsLocationFromLabel(
  label: string,
  organizationId?: string,
  strict = true
): Promise<GoogleAdsMarket> {
  const { city, state } = parseCityStateLabel(label);
  return resolveCityStateMarket({ city, state, organizationId, strict });
}
