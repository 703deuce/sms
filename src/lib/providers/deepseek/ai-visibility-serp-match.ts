import { logProviderRun } from "@/lib/providers/dataforseo";
import type { MapPackEntry, OrganicSerpEntry } from "@/lib/providers/scrapingdog/google-serp-snapshot";
import type { ExtractedBrandMention } from "@/lib/providers/deepseek/ai-visibility-mentions";
import {
  deduplicateMentionClusters,
  type MentionCluster,
  type TaggedMention,
} from "@/lib/providers/deepseek/ai-visibility-mention-dedupe";

const BASE_URL = "https://api.deepseek.com/v1";

export type SerpMatchRow = {
  name: string;
  normalizedName: string;
  aiEngineCount: number;
  inMapPack: boolean;
  mapPackPosition: number | null;
  inOrganic: boolean;
  organicPosition: number | null;
  placement: "both" | "map_pack_only" | "organic_only" | "ai_only";
  matchNote?: string | null;
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

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd)\b\.?/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function heuristicMatch(params: {
  mentions: Array<{ name: string; normalizedName: string; engineCount: number }>;
  mapPack: MapPackEntry[];
  organic: OrganicSerpEntry[];
}): SerpMatchRow[] {
  const mapTitles = params.mapPack.map((m) => ({ ...m, key: normalizeKey(m.title) }));
  const organicTitles = params.organic.map((o) => ({
    ...o,
    key: normalizeKey(o.title),
    domainKey: o.domain ? normalizeKey(o.domain.split(".")[0] ?? "") : "",
  }));

  return params.mentions.map((m) => {
    const key = m.normalizedName || normalizeKey(m.name);
    const mapHit = mapTitles.find(
      (x) => x.key.includes(key) || key.includes(x.key) || x.key.split(" ").every((t) => t.length > 2 && key.includes(t))
    );
    const organicHit = organicTitles.find(
      (x) =>
        x.key.includes(key) ||
        key.includes(x.key) ||
        (x.domainKey && key.includes(x.domainKey))
    );
    const inMapPack = Boolean(mapHit);
    const inOrganic = Boolean(organicHit);
    let placement: SerpMatchRow["placement"] = "ai_only";
    if (inMapPack && inOrganic) placement = "both";
    else if (inMapPack) placement = "map_pack_only";
    else if (inOrganic) placement = "organic_only";

    return {
      name: m.name,
      normalizedName: key,
      aiEngineCount: m.engineCount,
      inMapPack,
      mapPackPosition: mapHit?.position ?? null,
      inOrganic,
      organicPosition: organicHit?.position ?? null,
      placement,
    };
  });
}

export async function matchAiMentionsToGoogleSerp(params: {
  organizationId?: string;
  keyword: string;
  mentions: ExtractedBrandMention[];
  taggedMentions?: TaggedMention[];
  clusters?: MentionCluster[];
  engineCounts: Map<string, number>;
  mapPack: MapPackEntry[];
  organic: OrganicSerpEntry[];
}): Promise<SerpMatchRow[]> {
  let clusters = params.clusters;
  if (!clusters?.length) {
    const tagged =
      params.taggedMentions ??
      params.mentions.map((m) => ({
        name: m.name,
        normalizedName: m.normalizedName,
        engine: "chatgpt" as const,
      }));
    clusters = await deduplicateMentionClusters({
      organizationId: params.organizationId,
      keyword: params.keyword,
      items: tagged,
    });
  }

  const mentionList = clusters.map((c) => ({
    name: c.canonicalName,
    normalizedName: c.normalizedName,
    engineCount: c.engineCount,
  }));
  if (!mentionList.length) return [];

  const fallback = heuristicMatch({
    mentions: mentionList,
    mapPack: params.mapPack,
    organic: params.organic,
  }).sort((a, b) => b.aiEngineCount - a.aiEngineCount);

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return fallback;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const mapLines = params.mapPack.map((m) => `${m.position}. ${m.title}`).join("\n");
  const organicLines = params.organic.map((o) => `${o.position}. ${o.title}${o.domain ? ` (${o.domain})` : ""}`).join("\n");
  const aiLines = mentionList.map((m) => `- ${m.name} (mentioned by ${m.engineCount} AI engine(s))`).join("\n");

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
            content: `Match AI-mentioned companies to Google search results. Return valid JSON only.

Keyword: "${params.keyword}"

AI-mentioned companies:
${aiLines}

Google Map Pack (local results, top 10):
${mapLines || "(none)"}

Google organic page 1:
${organicLines || "(none)"}

For EACH unique business (deduplicated — one row per real company), determine if it appears in the map pack, organic results, both, or neither (ai_only).
Use fuzzy matching on business names (ignore LLC/Inc, abbreviations, city suffixes).

{
  "matches": [
    {
      "name": string,
      "normalized_name": string,
      "in_map_pack": boolean,
      "map_pack_position": number or null,
      "in_organic": boolean,
      "organic_position": number or null,
      "placement": "both" | "map_pack_only" | "organic_only" | "ai_only",
      "match_note": string or null
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    const data = await res.json();
    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "chat/completions/serp-match",
      request: { model, keyword: params.keyword, mentionCount: mentionList.length },
      response: data,
      statusCode: res.status,
      latencyMs: Date.now() - start,
    });

    if (!res.ok) return fallback;

    const content = data.choices?.[0]?.message?.content as string | undefined;
    const parsed = content ? parseJsonObject(content) : null;
    const matches = (parsed?.matches as Array<Record<string, unknown>>) ?? [];
    if (!matches.length) return fallback;

    return matches
      .filter((m) => typeof m.name === "string")
      .map((m) => {
        const key = normalizeKey(String(m.normalized_name ?? m.name));
        const src = mentionList.find(
          (x) => x.normalizedName === key || normalizeKey(x.name) === key
        );
        const placement = m.placement as SerpMatchRow["placement"];
        const validPlacement =
          placement === "both" ||
          placement === "map_pack_only" ||
          placement === "organic_only" ||
          placement === "ai_only"
            ? placement
            : "ai_only";

        return {
          name: src?.name ?? String(m.name),
          normalizedName: key,
          aiEngineCount: src?.engineCount ?? 1,
          inMapPack: Boolean(m.in_map_pack),
          mapPackPosition: m.map_pack_position != null ? Number(m.map_pack_position) : null,
          inOrganic: Boolean(m.in_organic),
          organicPosition: m.organic_position != null ? Number(m.organic_position) : null,
          placement: validPlacement,
          matchNote: typeof m.match_note === "string" ? m.match_note : null,
        };
      })
      .sort((a, b) => b.aiEngineCount - a.aiEngineCount);
  } catch {
    return fallback;
  }
}
