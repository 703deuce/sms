import { logProviderRun } from "@/lib/providers/dataforseo";

function getApiKey(): string {
  const key = process.env.SCRAPINGDOG_API_KEY ?? process.env.SCRAPING_DOG_API_KEY;
  if (!key) throw new Error("SCRAPINGDOG_API_KEY is required");
  return key;
}

export type GoogleSearchHit = {
  title?: string;
  url?: string;
  description?: string;
};

export async function scrapingDogGoogleSearch(params: {
  query: string;
  organizationId?: string;
}): Promise<GoogleSearchHit[]> {
  const start = Date.now();
  const path = "google";
  const queryParams = {
    query: params.query,
    country: "us",
    language: "en",
  };

  const url = new URL(`https://api.scrapingdog.com/${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [k, v] of Object.entries(queryParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  const text = await res.text();
  const latencyMs = Date.now() - start;

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  await logProviderRun({
    organizationId: params.organizationId,
    provider: "scrapingdog",
    endpoint: path,
    request: queryParams,
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) throw new Error(`Fallback search failed (${res.status})`);

  const payload = data as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const rows = payload.organic_results ?? payload.results ?? [];
  return rows.map((r) => ({
    title: r.title,
    url: r.link,
    description: r.snippet,
  }));
}
