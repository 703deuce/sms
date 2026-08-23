import { logProviderRun } from "@/lib/providers/dataforseo";
import type { AiEngine } from "@/lib/ai-visibility/types";
import { ENGINE_LABELS } from "@/lib/ai-visibility/types";

const BASE_URL = "https://api.deepseek.com/v1";

export type ExtractedBrandMention = {
  name: string;
  normalizedName: string;
  domain?: string | null;
  isTargetBrand: boolean;
  position?: number | null;
  context?: string | null;
  confidence?: number | null;
};

export type MentionExtraction = {
  targetBrandMentioned: boolean;
  mentionPosition: number | null;
  brandMentions: ExtractedBrandMention[];
  competitorNames: string[];
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

function normalizeObservedName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|pllc)\b\.?/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function heuristicExtraction(
  brandName: string,
  responseText: string
): MentionExtraction {
  const lower = responseText.toLowerCase();
  const brandLower = brandName.trim().toLowerCase();
  const mentioned = brandLower.length >= 2 && lower.includes(brandLower);
  return {
    targetBrandMentioned: mentioned,
    mentionPosition: mentioned ? null : null,
    brandMentions: mentioned
      ? [
          {
            name: brandName,
            normalizedName: normalizeObservedName(brandName),
            isTargetBrand: true,
            position: null,
          },
        ]
      : [],
    competitorNames: [],
  };
}

export async function extractMentionsFromResponse(params: {
  organizationId?: string;
  promptText: string;
  engine: AiEngine;
  responseText: string;
  brandName: string;
  domain?: string | null;
  sources?: Array<{ url?: string; label?: string }>;
}): Promise<MentionExtraction> {
  const text = params.responseText.trim();
  const fallback = heuristicExtraction(params.brandName, text);
  if (!text) return fallback;

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return fallback;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const platform = ENGINE_LABELS[params.engine];
  const citationLines = (params.sources ?? [])
    .slice(0, 12)
    .map((s) => `- ${s.label ?? s.url ?? ""}: ${s.url ?? ""}`)
    .join("\n");

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
            content: `Extract company mentions from this AI assistant response. Return valid JSON only — no markdown.

Target brand: "${params.brandName}"
Target domain: "${params.domain ?? ""}"
Platform: ${platform}
Prompt: ${params.promptText.slice(0, 400)}

Rules:
- List up to 12 businesses explicitly named in the response (competitors + target).
- Order by appearance when possible (position 1 = first mentioned).
- "context" must be under 80 characters.
- normalized_name: lowercase, strip LLC/Inc suffixes.
- Omit companies not clearly named in the response.

{
  "target_brand_mentioned": boolean,
  "mention_position": number or null,
  "brand_mentions": [
    {
      "name": string,
      "normalized_name": string,
      "domain": string or null,
      "is_target_brand": boolean,
      "position": number or null,
      "context": string or null,
      "confidence": number or null
    }
  ]
}

Citations:
${citationLines || "(none)"}

Response:
${text.slice(0, 5000)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2200,
      }),
    });

    const data = await res.json();
    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "chat/completions/mentions",
      request: { model, engine: params.engine },
      response: data,
      statusCode: res.status,
      latencyMs: Date.now() - start,
    });

    if (!res.ok) return fallback;

    const content = data.choices?.[0]?.message?.content as string | undefined;
    if (!content) return fallback;

    const parsed = parseJsonObject(content);
    if (!parsed) return fallback;

    const rawMentions = (parsed.brand_mentions as Array<Record<string, unknown>>) ?? [];
    const brandMentions: ExtractedBrandMention[] = rawMentions
      .filter((m) => typeof m.name === "string" && m.name.trim())
      .slice(0, 12)
      .map((m) => ({
        name: String(m.name).trim(),
        normalizedName: normalizeObservedName(String(m.normalized_name ?? m.name)),
        domain: typeof m.domain === "string" ? m.domain : null,
        isTargetBrand: Boolean(m.is_target_brand),
        position: m.position != null ? Number(m.position) : null,
        context: typeof m.context === "string" ? m.context.slice(0, 200) : null,
        confidence: m.confidence != null ? Number(m.confidence) : null,
      }));

    const targetBrandMentioned =
      Boolean(parsed.target_brand_mentioned) || brandMentions.some((m) => m.isTargetBrand);

    const mentionPosition =
      parsed.mention_position != null
        ? Number(parsed.mention_position)
        : brandMentions.find((m) => m.isTargetBrand)?.position ?? null;

    const competitorNames = brandMentions.filter((m) => !m.isTargetBrand).map((m) => m.name);

    return { targetBrandMentioned, mentionPosition, brandMentions, competitorNames };
  } catch {
    return fallback;
  }
}

export { normalizeObservedName };
