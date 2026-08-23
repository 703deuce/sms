import { logProviderRun } from "@/lib/providers/dataforseo";
import { resolveGoogleAdsLocation, type GoogleAdsLocation } from "@/lib/providers/dataforseo/google-ads-location";

function getCredentials(): { username: string; password: string } {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!username || !password) throw new Error("DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are required");
  return { username, password };
}

export type KeywordVolumeResult = {
  keyword: string;
  search_volume: number | null;
  competition: string | null;
  competition_index: number | null;
  cpc: number | null;
};

export async function fetchKeywordVolumes(params: {
  keywords: string[];
  city?: string | null;
  state?: string | null;
  location?: GoogleAdsLocation;
  organizationId?: string;
}): Promise<KeywordVolumeResult[]> {
  if (!params.keywords.length) return [];

  const location =
    params.location ??
    (await resolveGoogleAdsLocation({
      city: params.city,
      state: params.state,
      organizationId: params.organizationId,
    }));

  const start = Date.now();
  const endpoint = "keywords_data/google_ads/search_volume/live";
  const body = {
    keywords: params.keywords.slice(0, 1000).map((k) => k.trim()).filter(Boolean),
    location_code: location.location_code,
    language_code: "en",
    search_partners: false,
  };

  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${getCredentials().username}:${getCredentials().password}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([body]),
  });

  const data = await res.json();
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId: params.organizationId,
    provider: "dataforseo",
    endpoint,
    request: { ...body, location_name: location.location_name },
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) throw new Error(`Google Ads volume request failed (${res.status})`);

  const task = (
    data as {
      tasks?: Array<{
        status_code?: number;
        status_message?: string;
        result?: Array<{
          keyword?: string;
          search_volume?: number | null;
          competition?: string | null;
          competition_index?: number | null;
          cpc?: number | null;
        }>;
      }>;
    }
  ).tasks?.[0];

  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(task.status_message ?? `Google Ads volume error ${task.status_code}`);
  }

  const rows = task?.result ?? [];
  return rows.map((r) => ({
    keyword: r.keyword ?? "",
    search_volume: r.search_volume ?? null,
    competition: r.competition ?? null,
    competition_index: r.competition_index ?? null,
    cpc: r.cpc ?? null,
  }));
}

export {
  resolveGoogleAdsLocation,
  resolveCityStateMarket,
  resolveGoogleAdsLocationFromLabel,
  formatGoogleAdsLocationLabel,
  formatMarketDisplay,
  parseCityStateLabel,
  MarketResolutionError,
  type GoogleAdsMarket,
} from "@/lib/providers/dataforseo/google-ads-location";
