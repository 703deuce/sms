import { logProviderRun } from "@/lib/providers/dataforseo";
import type { AiEngine } from "@/lib/ai-visibility/types";
import { normalizeObservedName } from "@/lib/providers/deepseek/ai-visibility-mentions";

const BASE_URL = "https://api.deepseek.com/v1";

export type MentionCluster = {
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
  engineCount: number;
  engines: AiEngine[];
};

export type TaggedMention = {
  name: string;
  normalizedName: string;
  engine: AiEngine;
};

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickCanonicalName(names: string[]): string {
  const withCase = names.find((n) => /[A-Z]/.test(n));
  return withCase ?? names[0] ?? "";
}

const LOCATION_STOP = new Set([
  "the",
  "of",
  "and",
  "va",
  "llc",
  "inc",
  "corp",
  "ltd",
  "woodbridge",
  "fairfax",
  "northern",
  "virginia",
  "dmv",
  "junk",
  "removal",
  "hauling",
  "services",
  "service",
  "company",
  "companies",
]);

function distinctiveTokens(key: string): string[] {
  return key
    .split(" ")
    .filter((t) => t.length > 2 && !LOCATION_STOP.has(t));
}

function shareDistinctiveToken(a: string, b: string): boolean {
  const ta = distinctiveTokens(a);
  const tb = distinctiveTokens(b);
  if (!ta.length || !tb.length) return false;
  return ta.some((t) => tb.includes(t) && t.length >= 5);
}

function keysSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return shareDistinctiveToken(a, b);
}

export function heuristicDedupeMentionClusters(items: TaggedMention[]): MentionCluster[] {
  const clusters: Array<{
    keys: Set<string>;
    names: string[];
    engines: Set<AiEngine>;
  }> = [];

  for (const item of items) {
    const key = item.normalizedName || normalizeObservedName(item.name);
    if (!key) continue;

    let cluster = clusters.find((c) => [...c.keys].some((k) => keysSimilar(k, key)));
    if (!cluster) {
      cluster = { keys: new Set(), names: [], engines: new Set() };
      clusters.push(cluster);
    }
    cluster.keys.add(key);
    cluster.names.push(item.name);
    cluster.engines.add(item.engine);
  }

  return clusters.map((c) => {
    const aliases = [...new Set(c.names)];
    const normalizedName = [...c.keys].sort((a, b) => a.length - b.length)[0] ?? "";
    return {
      canonicalName: pickCanonicalName(aliases),
      normalizedName,
      aliases,
      engineCount: c.engines.size,
      engines: [...c.engines],
    };
  });
}

export async function deduplicateMentionClusters(params: {
  organizationId?: string;
  keyword?: string;
  items: TaggedMention[];
}): Promise<MentionCluster[]> {
  if (!params.items.length) return [];

  const fallback = heuristicDedupeMentionClusters(params.items);

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return fallback;

  const byKey = new Map<string, { names: Set<string>; engines: Set<AiEngine> }>();
  for (const item of params.items) {
    const key = item.normalizedName || normalizeObservedName(item.name);
    if (!key) continue;
    const row = byKey.get(key) ?? { names: new Set(), engines: new Set() };
    row.names.add(item.name);
    row.engines.add(item.engine);
    byKey.set(key, row);
  }

  const lines = [...byKey.entries()].map(([key, row]) => {
    const names = [...row.names].join(" | ");
    const engines = [...row.engines].join(", ");
    return `- ${names} [key: ${key}] (engines: ${engines})`;
  });

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `Group company names that refer to the SAME real business. Return valid JSON only.

Keyword context: "${params.keyword ?? ""}"

Each line is a distinct extracted name (same key = exact duplicate already merged):
${lines.join("\n")}

Rules:
- Merge aliases like "The Junkluggers", "Junkluggers of Woodbridge, VA", and "The Junkluggers of Woodbridge VA".
- Merge "Nova Junk" with "NOVA Junk Removal LLC" if they are the same operator.
- Do NOT merge clearly different businesses that only share generic words (e.g. two unrelated "Junk Removal" companies).
- Pick the clearest canonical_name for each cluster.
- Every input key must appear in exactly one cluster's member_keys array.

{
  "clusters": [
    {
      "canonical_name": string,
      "normalized_name": string,
      "member_keys": string[],
      "member_names": string[]
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2500,
      }),
    });

    const data = await res.json();
    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "chat/completions/mention-dedupe",
      request: { model, itemCount: params.items.length },
      response: data,
      statusCode: res.status,
      latencyMs: Date.now() - start,
    });

    if (!res.ok) return fallback;

    const content = data.choices?.[0]?.message?.content as string | undefined;
    const parsed = content ? parseJsonObject(content) : null;
    const rawClusters = (parsed?.clusters as Array<Record<string, unknown>>) ?? [];
    if (!rawClusters.length) return fallback;

    const usedKeys = new Set<string>();
    const result: MentionCluster[] = [];

    for (const c of rawClusters) {
      const memberKeys = (c.member_keys as string[] | undefined)?.map((k) => normalizeObservedName(k)) ?? [];
      const memberNames = (c.member_names as string[] | undefined) ?? [];
      const keys = memberKeys.filter((k) => k && byKey.has(k));
      if (!keys.length) continue;

      const engines = new Set<AiEngine>();
      const aliases = new Set<string>();
      for (const key of keys) {
        usedKeys.add(key);
        const row = byKey.get(key);
        if (!row) continue;
        for (const e of row.engines) engines.add(e);
        for (const n of row.names) aliases.add(n);
      }
      for (const n of memberNames) aliases.add(n);

      const canonical =
        typeof c.canonical_name === "string" && c.canonical_name.trim()
          ? c.canonical_name.trim()
          : pickCanonicalName([...aliases]);
      const normalizedName =
        typeof c.normalized_name === "string" && c.normalized_name.trim()
          ? normalizeObservedName(c.normalized_name)
          : keys[0] ?? normalizeObservedName(canonical);

      result.push({
        canonicalName: canonical,
        normalizedName,
        aliases: [...aliases],
        engineCount: engines.size,
        engines: [...engines],
      });
    }

    for (const [key, row] of byKey) {
      if (usedKeys.has(key)) continue;
      result.push({
        canonicalName: pickCanonicalName([...row.names]),
        normalizedName: key,
        aliases: [...row.names],
        engineCount: row.engines.size,
        engines: [...row.engines],
      });
    }

    return result.sort((a, b) => b.engineCount - a.engineCount);
  } catch {
    return fallback;
  }
}
