import { normalizeWord, wordToKeypadDigits } from "./keypad";
import type { KeywordEntry } from "./types";

/** Deterministic industry → commercial keypad words (no LLM). */
export const INDUSTRY_KEYWORD_MAP: Record<string, string[]> = {
  roofing: ["ROOF", "ROOFER", "ROOFS"],
  plumbing: ["PIPE", "PIPES", "PLUMB"],
  hvac: ["HVAC", "HEAT", "COOL", "AIR"],
  lawn_care: ["LAWN", "MOW", "MOWER"],
  junk_removal: ["JUNK", "HAUL"],
  moving: ["MOVE", "MOVERS"],
  legal: ["LAW", "LEGAL"],
  dental: ["DENTAL", "SMILE", "TEETH"],
  auto: ["AUTO", "CARS", "TIRE"],
};

function normalizeIndustryKey(industry: string): string {
  return industry.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function resolveIndustryKeywords(industry?: string): {
  primary: string[];
  industryKey?: string;
} {
  if (!industry?.trim()) return { primary: [] };
  const key = normalizeIndustryKey(industry);
  const words = INDUSTRY_KEYWORD_MAP[key];
  if (words) return { primary: words, industryKey: key };
  // Allow free-text industry as a single custom word when not in dictionary.
  const custom = normalizeWord(industry);
  if (custom.length >= 3) return { primary: [custom], industryKey: key };
  return { primary: [], industryKey: key };
}

export function buildKeywordEntries(input: {
  industry?: string;
  customKeywords?: string[];
}): KeywordEntry[] {
  const { primary, industryKey } = resolveIndustryKeywords(input.industry);
  const primarySet = new Set(primary.map(normalizeWord));
  const secondarySet = new Set<string>();

  if (industryKey && INDUSTRY_KEYWORD_MAP[industryKey]) {
    for (const w of INDUSTRY_KEYWORD_MAP[industryKey]) {
      if (!primarySet.has(normalizeWord(w))) secondarySet.add(normalizeWord(w));
    }
  }

  const custom = (input.customKeywords || [])
    .map((k) => normalizeWord(k))
    .filter((k) => k.length >= 3);

  const orderedWords: string[] = [];
  const seen = new Set<string>();
  const push = (w: string) => {
    const n = normalizeWord(w);
    if (!n || seen.has(n)) return;
    seen.add(n);
    orderedWords.push(n);
  };

  for (const w of primary) push(w);
  for (const w of custom) push(w);
  for (const w of secondarySet) push(w);

  return orderedWords
    .map((word) => {
      const digits = wordToKeypadDigits(word);
      if (digits.length < 3) return null;
      const isPrimary = primarySet.has(word);
      const isSecondary = !isPrimary && secondarySet.has(word);
      return {
        word,
        digits,
        isPrimary,
        isSecondary,
      };
    })
    .filter((e): e is KeywordEntry => e !== null);
}
