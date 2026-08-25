import { extractJsonFromLlm } from "@/lib/ai/llm";
import { inferIndustryFromText } from "./business-name-keywords";
import { INDUSTRY_KEYWORD_MAP } from "./industry-keywords";
import { normalizeWord } from "./keypad";

const MAX_KEYWORDS = 14;

/** Technical / insider terms average callers would not recognize on a vanity number. */
const CONSUMER_JARGON_BLOCKLIST = new Set([
  "AMP",
  "AMPS",
  "OHM",
  "OHMS",
  "JOULE",
  "JOULES",
  "HERTZ",
  "FARAD",
  "SIEMEN",
  "SIEMENS",
  "MILLI",
  "KILO",
  "GAUGE",
  "RELAY",
  "CONDUIT",
  "CIRCUIT",
  "VOLTAGE",
  "CURRENT",
  "PHASE",
  "HVACR",
  "BTU",
  "CFM",
  "PSI",
  "TORQ",
  "TORQUE",
  "FLUX",
  "COIL",
  "DIODE",
  "CAPACITOR",
  "WATT",
  "WATTS",
]);

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

function filterConsumerFriendlyKeywords(words: string[]): string[] {
  return words.filter((word) => !CONSUMER_JARGON_BLOCKLIST.has(word));
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
  const mapWords = inferred ? INDUSTRY_KEYWORD_MAP[inferred]?.map((d) => d.word) ?? [] : [];
  return filterConsumerFriendlyKeywords(
    normalizeKeywordList([...mapWords, industry]),
  );
}

async function openAiKeywordCompletion(system: string, user: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com"
  ).replace(/\/$/, "");
  const model =
    process.env.PREMIUM_KEYWORDS_OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`openai ${res.status}: ${errText.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

/**
 * OpenAI-powered vanity keyword ideas for an industry or trade.
 * Falls back to mapped industry words when OpenAI is not configured.
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
Given an industry or trade, return JSON only:
{"keywords":["WORD1","WORD2",...]}

Rules:
- 8–14 uppercase A–Z words (no digits), each 3–7 letters
- Telephone keypad spelling only (vanity letters)
- Words must be instantly recognizable to the AVERAGE consumer as belonging to this trade
- Use words people see on trucks, yard signs, and local ads (PLUMB, ROOF, DENTAL, LAWN, JUNK)
- Include the core trade word plus obvious synonyms (PLUMB, PLUMBER, PLUMBING)
- NO technical jargon, units, or insider abbreviations (no AMP, JOULE, OHM, BTU, PSI, HERTZ)
- NO words only a licensed tradesperson would know
- NO company filler (LLC, INC, THE)
- No duplicates`;

  try {
    const content = await openAiKeywordCompletion(system, trimmed);
    if (!content) {
      return { keywords: fallback, source: "deterministic" };
    }

    const parsed = extractJsonFromLlm(content) as { keywords?: string[] };
    const llmWords = filterConsumerFriendlyKeywords(
      normalizeKeywordList(parsed.keywords ?? []),
    );
    if (!llmWords.length) {
      return { keywords: fallback, source: "deterministic" };
    }
    const merged = filterConsumerFriendlyKeywords(
      normalizeKeywordList([...llmWords, ...fallback]),
    );
    return { keywords: merged, source: "llm" };
  } catch {
    return { keywords: fallback, source: "deterministic" };
  }
}
