import { logProviderRun } from "@/lib/providers/dataforseo";
import { normalizeDomain } from "@/lib/backlink-gap/domain";

function getCredentials(): { username: string; password: string } {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!username || !password) throw new Error("DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are required");
  return { username, password };
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_LIMIT = 500;

export type ReferringDomainItem = {
  domain: string;
  rank: number | null;
  backlinks: number;
  firstSeen: string | null;
  spamScore: number | null;
  platformTypes: Record<string, number>;
  referringPagesNofollow: number | null;
  raw: Record<string, unknown>;
};

export type BacklinkSample = {
  sourceUrl: string | null;
  targetUrl: string | null;
  anchor: string | null;
  pageTitle: string | null;
  dofollow: boolean | null;
  firstSeen: string | null;
  lastSeen: string | null;
  raw: Record<string, unknown>;
};

async function dataForSeoPost<T>(
  endpoint: string,
  body: unknown[],
  organizationId?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${getCredentials().username}:${getCredentials().password}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json();
    const latencyMs = Date.now() - start;

    await logProviderRun({
      organizationId,
      provider: "dataforseo",
      endpoint,
      request: body,
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) throw new Error(`Backlinks request failed (${res.status})`);

    const task = (data as { tasks?: Array<{ status_code?: number; status_message?: string; result?: unknown[] }> })
      .tasks?.[0];
    if (task?.status_code && task.status_code >= 40000 && task.status_code < 50000) {
      throw new Error(task.status_message ?? `Backlinks task error ${task.status_code}`);
    }

    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export async function fetchReferringDomains(params: {
  target: string;
  organizationId?: string;
  limit?: number;
  retries?: number;
}): Promise<{ items: ReferringDomainItem[]; totalCount: number; warning?: string }> {
  const domain = normalizeDomain(params.target);
  if (!domain) throw new Error("Invalid target domain");

  const limit = params.limit ?? DEFAULT_LIMIT;
  const maxAttempts = (params.retries ?? 1) + 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await dataForSeoPost<{
        tasks?: Array<{
          result?: Array<{
            total_count?: number;
            items?: Array<Record<string, unknown>>;
          }>;
        }>;
      }>(
        "backlinks/referring_domains/live",
        [
          {
            target: domain,
            limit,
            order_by: ["rank,desc"],
            exclude_internal_backlinks: true,
            backlinks_status_type: "live",
            rank_scale: "one_thousand",
          },
        ],
        params.organizationId
      );

      const result = data.tasks?.[0]?.result?.[0];
      const items: ReferringDomainItem[] = (result?.items ?? []).map((item) => ({
        domain: normalizeDomain(String(item.domain ?? "")) ?? "",
        rank: typeof item.rank === "number" ? item.rank : null,
        backlinks: typeof item.backlinks === "number" ? item.backlinks : 0,
        firstSeen: parseDate(item.first_seen as string | undefined),
        spamScore: typeof item.backlinks_spam_score === "number" ? item.backlinks_spam_score : null,
        platformTypes: (item.referring_links_platform_types as Record<string, number>) ?? {},
        referringPagesNofollow:
          typeof item.referring_pages_nofollow === "number" ? item.referring_pages_nofollow : null,
        raw: item,
      }));

      return {
        items: items.filter((i) => i.domain),
        totalCount: result?.total_count ?? items.length,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw lastError ?? new Error("Failed to fetch referring domains");
}

export async function fetchSampleBacklink(params: {
  target: string;
  referringDomain: string;
  organizationId?: string;
}): Promise<BacklinkSample | null> {
  const domain = normalizeDomain(params.target);
  const referring = normalizeDomain(params.referringDomain);
  if (!domain || !referring) return null;

  try {
    const data = await dataForSeoPost<{
      tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
    }>(
      "backlinks/backlinks/live",
      [
        {
          target: domain,
          limit: 1,
          order_by: ["rank,desc"],
          exclude_internal_backlinks: true,
          backlinks_status_type: "live",
          filters: [["domain_from", "=", referring]],
        },
      ],
      params.organizationId,
      45_000
    );

    const item = data.tasks?.[0]?.result?.[0]?.items?.[0];
    if (!item) return null;

    const attrs = (item.attributes as string[] | undefined) ?? [];
    const dofollow = attrs.includes("nofollow") ? false : attrs.includes("dofollow") ? true : null;

    return {
      sourceUrl: (item.url_from as string) ?? (item.source_url as string) ?? null,
      targetUrl: (item.url_to as string) ?? (item.target_url as string) ?? null,
      anchor: (item.anchor as string) ?? null,
      pageTitle: (item.page_from_title as string) ?? (item.page_title as string) ?? null,
      dofollow,
      firstSeen: parseDate(item.first_seen as string | undefined),
      lastSeen: parseDate(item.last_seen as string | undefined),
      raw: item,
    };
  } catch {
    return null;
  }
}
