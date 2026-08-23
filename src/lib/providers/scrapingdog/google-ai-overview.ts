import { logProviderRun } from "@/lib/providers/dataforseo";

function getApiKey(): string | null {
  return process.env.SCRAPINGDOG_API_KEY?.trim() ?? process.env.SCRAPING_DOG_API_KEY?.trim() ?? null;
}

export function isScrapingDogGoogleAiConfigured(): boolean {
  return Boolean(getApiKey());
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function flattenTextBlocks(textBlocks: unknown): string {
  if (!Array.isArray(textBlocks)) return "";
  const parts: string[] = [];
  for (const b of textBlocks) {
    if (!isRecord(b)) continue;
    if (typeof b.snippet === "string" && b.snippet.trim()) parts.push(b.snippet.trim());
    const list = b.list;
    if (Array.isArray(list)) {
      for (const row of list) {
        if (isRecord(row) && typeof row.snippet === "string" && row.snippet.trim()) {
          parts.push(row.snippet.trim());
        }
      }
    }
  }
  return parts.join("\n\n").slice(0, 12_000);
}

function referencesFromList(refs: unknown): Array<{ url?: string; label?: string; position?: number }> {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((r, i) => {
      if (!isRecord(r)) return null;
      const url = typeof r.link === "string" ? r.link : typeof r.url === "string" ? r.url : undefined;
      const label =
        typeof r.title === "string"
          ? r.title
          : typeof r.source === "string"
            ? r.source
            : undefined;
      if (!url) return null;
      return { url, label, position: i + 1 };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function buildOverviewPayload(inner: Record<string, unknown>): {
  text: string;
  sources: Array<{ url?: string; label?: string; position?: number }>;
} {
  const blocks = inner.text_blocks ?? inner.textBlocks;
  const markdown =
    typeof inner.markdown === "string" && inner.markdown.trim()
      ? inner.markdown.trim()
      : flattenTextBlocks(blocks);
  const sources = referencesFromList(inner.references ?? inner.References);
  return { text: markdown, sources };
}

function extractInlineAiOverview(raw: Record<string, unknown>): Record<string, unknown> | null {
  const aio = raw.ai_overview ?? raw.aiOverview;
  if (!isRecord(aio)) return null;
  if (Array.isArray(aio.text_blocks) || Array.isArray(aio.textBlocks) || Array.isArray(aio.references)) {
    return aio;
  }
  return null;
}

/** Prefer ScrapingDog's ready-made link, then Google's async URL from the ai_overview stub. */
function resolveAiOverviewFetchTarget(serpRaw: Record<string, unknown>): {
  kind: "scrapingdog_link" | "google_url";
  value: string;
} | null {
  const aio = serpRaw.ai_overview ?? serpRaw.aiOverview;
  if (!isRecord(aio)) return null;

  const scrapingdogLink =
    typeof aio.scrapingdog_link === "string"
      ? aio.scrapingdog_link
      : typeof aio.scrapingdogLink === "string"
        ? aio.scrapingdogLink
        : null;
  if (scrapingdogLink?.startsWith("http")) {
    return { kind: "scrapingdog_link", value: scrapingdogLink };
  }

  const googleUrl =
    typeof aio.url === "string"
      ? aio.url
      : typeof aio.ai_overview_url === "string"
        ? aio.ai_overview_url
        : typeof aio.aiOverviewUrl === "string"
          ? aio.aiOverviewUrl
          : null;
  if (googleUrl?.startsWith("http")) {
    return { kind: "google_url", value: googleUrl };
  }

  return null;
}

async function fetchGoogleSerp(query: string, organizationId?: string): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("SCRAPINGDOG_API_KEY is not configured");

  // advance_search is required for reliable AI Overview payloads (inline or fallback stub).
  const url = new URL("https://api.scrapingdog.com/google");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query.slice(0, 400));
  url.searchParams.set("country", "us");
  url.searchParams.set("language", "en");
  url.searchParams.set("advance_search", "true");

  const start = Date.now();
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId,
    provider: "scrapingdog",
    endpoint: "google",
    request: { query, advance_search: true },
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    throw new Error(String(data.message ?? data.error ?? `ScrapingDog google ${res.status}`));
  }
  return data;
}

async function fetchAiOverviewByGoogleUrl(fetchUrl: string, organizationId?: string): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("SCRAPINGDOG_API_KEY is not configured");

  const url = new URL("https://api.scrapingdog.com/google/ai_overview");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("url", fetchUrl);

  const start = Date.now();
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId,
    provider: "scrapingdog",
    endpoint: "google/ai_overview",
    request: { url: fetchUrl },
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    throw new Error(String(data.message ?? data.error ?? `ScrapingDog ai_overview ${res.status}`));
  }
  return data;
}

function assertScrapingDogHost(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid ScrapingDog link");
  }
  if (parsed.protocol !== "https:") throw new Error("Invalid ScrapingDog link");
  const host = parsed.hostname.toLowerCase();
  if (host !== "api.scrapingdog.com" && host !== "scrapingdog.com" && !host.endsWith(".scrapingdog.com")) {
    throw new Error("ScrapingDog link host not allowed");
  }
}

async function fetchAiOverviewByScrapingDogLink(
  scrapingdogLink: string,
  organizationId?: string
): Promise<Record<string, unknown>> {
  const start = Date.now();
  assertScrapingDogHost(scrapingdogLink);
  const res = await fetch(scrapingdogLink, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId,
    provider: "scrapingdog",
    endpoint: "google/ai_overview (scrapingdog_link)",
    request: { scrapingdog_link: scrapingdogLink.slice(0, 200) },
    response: data,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    throw new Error(String(data.message ?? data.error ?? `ScrapingDog ai_overview link ${res.status}`));
  }
  return data;
}

export type GoogleAiOverviewResult = {
  text: string;
  sources: Array<{ url?: string; label?: string; position?: number }>;
  fanouts: string[];
  hasAiOverview: boolean;
};

export type GoogleAiOverviewOutcome =
  | { ok: true; result: GoogleAiOverviewResult }
  | { ok: false; error: string };

export async function fetchGoogleAiOverviewDetailed(params: {
  query: string;
  organizationId?: string;
}): Promise<GoogleAiOverviewOutcome> {
  if (!isScrapingDogGoogleAiConfigured()) {
    return { ok: false, error: "SCRAPINGDOG_API_KEY not configured — required for Google AI Overview" };
  }

  const q = params.query.trim().slice(0, 400);
  if (!q) return { ok: false, error: "Google AI Overview query is empty" };

  try {
    const serpRaw = await fetchGoogleSerp(q, params.organizationId);
    const inline = extractInlineAiOverview(serpRaw);
    if (inline) {
      const parsed = buildOverviewPayload(inline);
      if (parsed.text || parsed.sources.length) {
        return {
          ok: true,
          result: { ...parsed, fanouts: [], hasAiOverview: true },
        };
      }
    }

    const target = resolveAiOverviewFetchTarget(serpRaw);
    if (!target) {
      return {
        ok: true,
        result: { text: "", sources: [], fanouts: [], hasAiOverview: false },
      };
    }

    const detail =
      target.kind === "scrapingdog_link"
        ? await fetchAiOverviewByScrapingDogLink(target.value, params.organizationId)
        : await fetchAiOverviewByGoogleUrl(target.value, params.organizationId);

    const inner = isRecord(detail.ai_overview)
      ? (detail.ai_overview as Record<string, unknown>)
      : isRecord(detail.aiOverview)
        ? (detail.aiOverview as Record<string, unknown>)
        : detail;
    const parsed = buildOverviewPayload(inner);
    const hasAiOverview = Boolean(parsed.text || parsed.sources.length);
    return { ok: true, result: { ...parsed, fanouts: [], hasAiOverview } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "ScrapingDog AI Overview request failed";
    return { ok: false, error: message };
  }
}

export async function fetchGoogleAiOverview(params: {
  query: string;
  organizationId?: string;
}): Promise<GoogleAiOverviewResult | null> {
  const outcome = await fetchGoogleAiOverviewDetailed(params);
  return outcome.ok ? outcome.result : null;
}
