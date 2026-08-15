import { extractJsonFromLlm, llmChatCompletion } from "@/lib/ai/llm";
import { inferIndustryFromText } from "./business-name-keywords";
import { INDUSTRY_KEYWORD_MAP } from "./industry-keywords";
import { normalizeWord } from "./keypad";

const MAX_KEYWORDS = 24;

function normalizeKeywordList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const word = normalizeWord(raw);
    if (word.length < 3 || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

/** Merge LLM + user keyword lists with optional extras (e.g. MIKE for Mike's Plumber). */
export function mergeCustomerKeywords(input: {
  suggestedKeywords?: string[];
  extraKeywords?: string[];
}): string[] {
  const chunks: string[] = [];
  if (input.suggestedKeywords?.length) chunks.push(...input.suggestedKeywords);
  if (input.extraKeywords?.length) chunks.push(...input.extraKeywords);
  return normalizeKeywordList(chunks);
}

function deterministicIndustryKeywords(industry: string): string[] {
  const inferred = inferIndustryFromText(industry);
  const mapWords = inferred ? INDUSTRY_KEYWORD_MAP[inferred] ?? [] : [];
  return normalizeKeywordList([...mapWords, industry]);
}

/**
 * LLM vanity keyword ideas for an industry or trade.
 * Falls back to mapped industry words when no LLM is configured.
 */
export async function suggestIndustryVanityKeywords(
  industry: string,
): Promise<{ keywords: string[]; source: "llm" | "deterministic" }> {
  const trimmed = industry.trim();
  if (!trimmed) {
    return { keywords: [], source: "deterministic" };
  }

  const fallback = deterministicIndustryKeywords(trimmed);

  const system = `You help US businesses find memorable vanity phone numbers.
Given an industry or trade (plumbing, roofing, junk removal, law firm, dental, HVAC, etc.), return JSON only:
{"keywords":["WORD1","WORD2",...]}

Rules:
- 10–24 uppercase A–Z words (no digits), each 3–7 letters
- Words must use telephone keypad letters (vanity spelling)
- Include the core trade word plus synonyms, short adspeak, and common customer phrases
- Examples: plumbing → PLUMB, PLUMBER, PLUMBING, PIPES, DRAIN; roofing → ROOF, ROOFER, SHINGLE
- Prefer words people say in ads and on trucks
- No filler (LLC, INC, THE)
- No duplicates`;

  try {
    const result = await llmChatCompletion(system, trimmed, {
      temperature: 0.4,
      maxTokens: 900,
    });
    if (!result?.content) {
      return { keywords: fallback, source: "deterministic" };
    }

    const parsed = extractJsonFromLlm(result.content) as { keywords?: string[] };
    const llmWords = normalizeKeywordList(parsed.keywords ?? []);
    if (!llmWords.length) {
      return { keywords: fallback, source: "deterministic" };
    }
    const merged = normalizeKeywordList([...llmWords, ...fallback]);
    return { keywords: merged, source: "llm" };
  } catch {
    return { keywords: fallback, source: "deterministic" };
  }
}
