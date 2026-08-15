import { extractJsonFromLlm, llmChatCompletion } from "@/lib/ai/llm";
import { extractBusinessNameKeywords } from "./business-name-keywords";
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

/** Merge customer keyword fields into one deduped search list (primary first). */
export function mergeCustomerKeywords(input: {
  primaryKeyword?: string;
  suggestedKeywords?: string[];
  extraKeywords?: string[];
  businessName?: string;
}): string[] {
  const chunks: string[] = [];
  if (input.primaryKeyword?.trim()) chunks.push(input.primaryKeyword.trim());
  if (input.suggestedKeywords?.length) chunks.push(...input.suggestedKeywords);
  if (input.extraKeywords?.length) chunks.push(...input.extraKeywords);
  if (input.businessName?.trim()) chunks.push(...extractBusinessNameKeywords(input.businessName));
  return normalizeKeywordList(chunks);
}

/**
 * LLM-powered vanity keyword ideas from a business description.
 * Falls back to deterministic name tokenization when no LLM is configured.
 */
export async function suggestBusinessVanityKeywords(
  businessDescription: string,
): Promise<{ keywords: string[]; source: "llm" | "deterministic" }> {
  const trimmed = businessDescription.trim();
  if (!trimmed) {
    return { keywords: [], source: "deterministic" };
  }

  const fallback = normalizeKeywordList(extractBusinessNameKeywords(trimmed));

  const system = `You help US businesses find memorable vanity phone numbers.
Given a business name or short description, return JSON only:
{"keywords":["WORD1","WORD2",...]}

Rules:
- 8–20 uppercase A–Z words (no digits), each 3–7 letters
- Words must map to telephone keypad letters (vanity spelling)
- Include the core trade word, synonyms, and short catchy variants customers would dial
- Prefer words people say in ads (e.g. ROOF, PLUMB, LAWN, DENTAL)
- No company filler (LLC, INC, THE)
- No duplicates`;

  try {
    const result = await llmChatCompletion(system, trimmed, {
      temperature: 0.4,
      maxTokens: 800,
    });
    if (!result?.content) {
      return { keywords: fallback, source: "deterministic" };
    }

    const parsed = extractJsonFromLlm(result.content) as { keywords?: string[] };
    const llmWords = normalizeKeywordList(parsed.keywords ?? []);
    if (!llmWords.length) {
      return { keywords: fallback, source: "deterministic" };
    }
    return { keywords: llmWords, source: "llm" };
  } catch {
    return { keywords: fallback, source: "deterministic" };
  }
}
