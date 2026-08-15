import { normalizeWord, wordToKeypadDigits } from "./keypad";
import type { KeywordEntry } from "./types";

/**
 * Deterministic industry → commercial keypad words (no LLM).
 * Longer words listed first — rare but high value when inventory exists.
 */
export const INDUSTRY_KEYWORD_MAP: Record<string, string[]> = {
  roofing: [
    "ROOFING",
    "ROOFERS",
    "ROOFER",
    "SHINGLE",
    "RAFTERS",
    "RAFTER",
    "ROOFS",
    "ROOF",
  ],
  plumbing: [
    "PLUMBER",
    "PLUMBERS",
    "PLUMBING",
    "FIXING",
    "FAUCET",
    "DRAINS",
    "PLUMB",
    "PIPES",
    "PIPE",
    "DRAIN",
    "FIXER",
    "LEAKS",
  ],
  hvac: [
    "HEATING",
    "COOLING",
    "FURNACE",
    "HEATERS",
    "COOLERS",
    "HEATER",
    "HVAC",
    "HEAT",
    "COOL",
    "AIR",
  ],
  lawn_care: [
    "MOWING",
    "MOWERS",
    "TRIMMER",
    "GARDEN",
    "MOWER",
    "CUTTER",
    "LAWNS",
    "GRASS",
    "LAWN",
    "MOW",
    "YARD",
  ],
  junk_removal: [
    "HAULING",
    "REMOVAL",
    "HAULER",
    "REMOVE",
    "TRASH",
    "LOADS",
    "JUNK",
    "HAUL",
  ],
  moving: [
    "MOVING",
    "MOVERS",
    "PACKERS",
    "PACKER",
    "MOVER",
    "MOVE",
    "LOAD",
  ],
  legal: [
    "LAWYERS",
    "LAWYER",
    "ATTORNEY",
    "LITIGATE",
    "LEGAL",
    "TRIAL",
    "LAW",
  ],
  dental: [
    "DENTIST",
    "BRACES",
    "SMILES",
    "DENTAL",
    "TOOTH",
    "SMILE",
    "TEETH",
  ],
  auto: [
    "MECHANIC",
    "REPAIR",
    "GARAGE",
    "MOTORS",
    "BRAKES",
    "TIRES",
    "PARTS",
    "AUTO",
    "CARS",
    "TIRE",
  ],
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
  const custom = normalizeWord(industry);
  if (custom.length >= 3) return { primary: [custom], industryKey: key };
  return { primary: [], industryKey: key };
}

export function buildKeywordEntries(input: {
  industry?: string;
  customKeywords?: string[];
  primaryKeywords?: string[];
}): KeywordEntry[] {
  const { primary, industryKey } = resolveIndustryKeywords(input.industry);
  const primarySet = new Set(primary.map(normalizeWord));
  for (const w of input.primaryKeywords ?? []) {
    const n = normalizeWord(w);
    if (n.length >= 3) primarySet.add(n);
  }
  const secondarySet = new Set<string>();

  if (industryKey && INDUSTRY_KEYWORD_MAP[industryKey]) {
    for (const w of INDUSTRY_KEYWORD_MAP[industryKey]) {
      if (!primarySet.has(normalizeWord(w))) secondarySet.add(normalizeWord(w));
    }
  }

  const custom = (input.customKeywords || [])
    .map((k) => normalizeWord(k))
    .filter((k) => k.length >= 3);

  // Customer-entered keywords reflect explicit search intent — treat as primary.
  for (const w of custom) primarySet.add(w);

  const orderedWords: string[] = [];
  const seen = new Set<string>();
  const push = (w: string) => {
    const n = normalizeWord(w);
    if (!n || seen.has(n)) return;
    seen.add(n);
    orderedWords.push(n);
  };

  // Longer words first for search priority and display.
  const allWords = [...primary, ...custom, ...secondarySet];
  allWords.sort((a, b) => b.length - a.length);
  for (const w of allWords) push(w);

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

/** Export helper: longest matched primary word length for a candidate. */
export function longestMatchedWordLength(
  matchedWords: string[],
  keywords: KeywordEntry[],
): number {
  let max = 0;
  for (const w of matchedWords) {
    const entry = keywords.find((k) => k.word === w);
    if (entry) max = Math.max(max, entry.word.length);
  }
  return max;
}
