import { logProviderRun } from "@/lib/providers/dataforseo";

function getCredentials(): { username: string; password: string } {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!username || !password) throw new Error("DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are required");
  return { username, password };
}

export type OrganicResult = {
  title?: string;
  url?: string;
  description?: string;
  domain?: string;
};

export async function dataForSeoOrganicSearch(params: {
  keyword: string;
  organizationId?: string;
  depth?: number;
  locationName?: string;
}): Promise<OrganicResult[]> {
  const start = Date.now();
  const endpoint = "serp/google/organic/live/advanced";
  const body = {
    keyword: params.keyword,
    location_name: params.locationName ?? "United States",
    language_code: "en",
    device: "desktop",
    os: "windows",
    depth: params.depth ?? 10,
  };

  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${getCredentials().username}:${getCredentials().password}`).toString("base64"),
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
    request: body,
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) throw new Error(`Search request failed (${res.status})`);

  const task = (data as { tasks?: Array<{ status_code?: number; result?: Array<{ items?: OrganicResult[] }> }> })
    .tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(`Search task error ${task.status_code}`);
  }

  const items = task?.result?.[0]?.items ?? [];
  return items.filter((i) => i.url);
}
