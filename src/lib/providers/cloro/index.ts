import { logProviderRun } from "@/lib/providers/dataforseo";
import type { AiEngine } from "@/lib/ai-visibility/types";

const CHATGPT_URL = "https://api.cloro.dev/v1/monitor/chatgpt";
const PERPLEXITY_URL = "https://api.cloro.dev/v1/monitor/perplexity";
/** Perplexity is usually fast; ChatGPT sync can take several minutes per Cloro docs. */
const PERPLEXITY_TIMEOUT_MS = 180_000;
const CHATGPT_TIMEOUT_MS = 300_000;

export type CloroSource = {
  position?: number;
  url?: string;
  label?: string;
  title?: string;
  description?: string;
  snippet?: string;
};

export type CloroMonitorResult = {
  text: string;
  markdown?: string;
  sources: CloroSource[];
  fanouts: string[];
  mapNames: string[];
  raw: Record<string, unknown>;
};

type CloroChatGptResult = {
  text?: string;
  markdown?: string;
  sources?: CloroSource[];
  searchQueries?: string[];
  map?: Array<{ name?: string; title?: string }>;
};

type CloroPerplexityResult = {
  text?: string;
  markdown?: string;
  sources?: CloroSource[];
  related_queries?: string[];
  search_model_queries?: Array<{ query?: string }>;
};

type CloroMonitorResponse<T> = {
  success: boolean;
  result?: T;
  error?: string;
  message?: string;
};

export type CloroMonitorOutcome =
  | { ok: true; result: CloroMonitorResult }
  | { ok: false; error: string };

export function isCloroConfigured(): boolean {
  return Boolean(process.env.CLORO_API_KEY?.trim());
}

function getCloroApiKey(): string {
  const key = process.env.CLORO_API_KEY?.trim();
  if (!key) throw new Error("CLORO_API_KEY is not configured");
  return key;
}

function proseFromResult(result: { markdown?: string; text?: string }): string {
  return (result.markdown ?? result.text ?? "").trim();
}

function mapSources(sources: CloroSource[] | undefined): CloroSource[] {
  return (sources ?? []).map((s, i) => ({
    ...s,
    label: s.label ?? s.title,
    position: s.position ?? i + 1,
  }));
}

function toMonitorResult(
  data: CloroMonitorResponse<unknown>,
  prose: string,
  sources: CloroSource[],
  fanouts: string[],
  mapNames: string[] = []
): CloroMonitorResult {
  return { text: prose, sources, fanouts, mapNames, raw: data as Record<string, unknown> };
}

async function postCloroMonitor<T>(
  url: string,
  body: Record<string, unknown>,
  label: string,
  organizationId?: string,
  timeoutMs = PERPLEXITY_TIMEOUT_MS
): Promise<CloroMonitorResponse<T>> {
  const apiKey = getCloroApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = url.replace("https://api.cloro.dev/v1/monitor/", "");
  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const raw = (await res.json()) as CloroMonitorResponse<T> & { message?: string };
  const latencyMs = Date.now() - start;

  await logProviderRun({
    organizationId,
    provider: "cloro",
    endpoint,
    request: body,
    response: raw,
    statusCode: res.status,
    latencyMs,
  });

  if (!res.ok) {
    const msg =
      typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : JSON.stringify(raw.message ?? raw.error ?? raw);
    throw new Error(`Cloro ${label} error (${res.status}): ${msg}`);
  }
  if (!raw.success || !raw.result) {
    const detail =
      typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : JSON.stringify(raw.message ?? raw.error ?? raw);
    throw new Error(`Cloro ${label} returned success=false: ${detail}`);
  }
  return raw;
}

export async function scrapeCloroChatGpt(params: {
  prompt: string;
  country?: string;
  organizationId?: string;
}): Promise<CloroMonitorResult> {
  // Keep include minimal: markdown is enough for mention extraction.
  // searchQueries adds +2 credits and is optional for visibility scoring.
  const response = await postCloroMonitor<CloroChatGptResult>(
    CHATGPT_URL,
    {
      prompt: params.prompt,
      country: params.country ?? "US",
      include: { markdown: true },
    },
    "ChatGPT",
    params.organizationId,
    CHATGPT_TIMEOUT_MS
  );
  const result = response.result!;
  const prose = proseFromResult(result);
  const fanouts = (result.searchQueries ?? []).map((q) => q.trim()).filter(Boolean);
  const map = result.map ?? [];
  const mapNames = map.map((m) => m.name ?? m.title ?? "").filter(Boolean);
  return toMonitorResult(response, prose, mapSources(result.sources), fanouts, mapNames);
}

function perplexityFanouts(result: CloroPerplexityResult): string[] {
  const fromSearch = (result.search_model_queries ?? [])
    .map((q) => q.query?.trim())
    .filter((q): q is string => Boolean(q));
  const related = (result.related_queries ?? []).map((q) => q.trim()).filter(Boolean);
  return [...new Set([...fromSearch, ...related])];
}

export async function scrapeCloroPerplexity(params: {
  prompt: string;
  country?: string;
  organizationId?: string;
}): Promise<CloroMonitorResult> {
  const response = await postCloroMonitor<CloroPerplexityResult>(
    PERPLEXITY_URL,
    {
      prompt: params.prompt,
      country: params.country ?? "US",
      include: { markdown: true, sources: true },
    },
    "Perplexity",
    params.organizationId
  );
  const result = response.result!;
  const prose = proseFromResult(result);
  return toMonitorResult(response, prose, mapSources(result.sources), perplexityFanouts(result));
}

export async function cloroMonitorDetailed(params: {
  engine: AiEngine;
  prompt: string;
  country?: string;
  organizationId?: string;
}): Promise<CloroMonitorOutcome> {
  if (params.engine !== "chatgpt" && params.engine !== "perplexity") {
    return { ok: false, error: `${params.engine} is not served by Cloro` };
  }

  if (!isCloroConfigured()) {
    return {
      ok: false,
      error: "CLORO_API_KEY not configured — add to .env.local and restart dev server",
    };
  }

  try {
    const result =
      params.engine === "chatgpt"
        ? await scrapeCloroChatGpt(params)
        : await scrapeCloroPerplexity(params);
    if (!result.text) {
      return { ok: false, error: `${params.engine} (Cloro): empty response` };
    }
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloro request failed";
    return { ok: false, error: message };
  }
}

/** @deprecated Cloro only supports chatgpt and perplexity — use scrapeCloroChatGpt/scrapeCloroPerplexity */
export async function cloroMonitor(params: {
  engine: AiEngine;
  prompt: string;
  country?: string;
  organizationId?: string;
}): Promise<CloroMonitorResult | null> {
  const outcome = await cloroMonitorDetailed(params);
  return outcome.ok ? outcome.result : null;
}
