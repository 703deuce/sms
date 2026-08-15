import { normalizeWord, wordToKeypadDigits } from "./keypad";
import type { KeywordEntry, KeywordTier } from "./types";

type IndustryKeywordDef = { word: string; tier: KeywordTier };

/**
 * Deterministic industry → commercial keypad words with importance tiers.
 */
export const INDUSTRY_KEYWORD_MAP: Record<string, IndustryKeywordDef[]> = {
  roofing: [
    { word: "ROOF", tier: "PRIMARY" },
    { word: "ROOFER", tier: "PRIMARY" },
    { word: "ROOFS", tier: "PRIMARY" },
    { word: "ROOFING", tier: "PRIMARY" },
    { word: "ROOFERS", tier: "PRIMARY" },
    { word: "SHINGLE", tier: "SECONDARY" },
    { word: "RAFTER", tier: "SECONDARY" },
    { word: "RAFTERS", tier: "SECONDARY" },
    { word: "HOME", tier: "TERTIARY" },
    { word: "FIX", tier: "TERTIARY" },
  ],
  plumbing: [
    { word: "PLUMB", tier: "PRIMARY" },
    { word: "PIPE", tier: "PRIMARY" },
    { word: "DRAIN", tier: "PRIMARY" },
    { word: "PLUMBER", tier: "PRIMARY" },
    { word: "PLUMBERS", tier: "PRIMARY" },
    { word: "PLUMBING", tier: "PRIMARY" },
    { word: "PIPES", tier: "SECONDARY" },
    { word: "DRAINS", tier: "SECONDARY" },
    { word: "LEAK", tier: "SECONDARY" },
    { word: "LEAKS", tier: "SECONDARY" },
    { word: "WATER", tier: "SECONDARY" },
    { word: "FIXER", tier: "TERTIARY" },
    { word: "FIXING", tier: "TERTIARY" },
    { word: "FAUCET", tier: "TERTIARY" },
  ],
  hvac: [
    { word: "HVAC", tier: "PRIMARY" },
    { word: "HEAT", tier: "PRIMARY" },
    { word: "COOL", tier: "PRIMARY" },
    { word: "HEATING", tier: "PRIMARY" },
    { word: "COOLING", tier: "PRIMARY" },
    { word: "HEATER", tier: "SECONDARY" },
    { word: "HEATERS", tier: "SECONDARY" },
    { word: "COOLERS", tier: "SECONDARY" },
    { word: "FURNACE", tier: "SECONDARY" },
    { word: "AIR", tier: "TERTIARY" },
  ],
  lawn_care: [
    { word: "LAWN", tier: "PRIMARY" },
    { word: "MOWER", tier: "PRIMARY" },
    { word: "GRASS", tier: "PRIMARY" },
    { word: "MOWING", tier: "SECONDARY" },
    { word: "MOWERS", tier: "SECONDARY" },
    { word: "YARD", tier: "SECONDARY" },
    { word: "MOW", tier: "SECONDARY" },
    { word: "LAWNS", tier: "SECONDARY" },
    { word: "TRIMMER", tier: "TERTIARY" },
    { word: "GARDEN", tier: "TERTIARY" },
    { word: "CUTTER", tier: "TERTIARY" },
  ],
  junk_removal: [
    { word: "JUNK", tier: "PRIMARY" },
    { word: "HAUL", tier: "PRIMARY" },
    { word: "REMOVAL", tier: "PRIMARY" },
    { word: "TRASH", tier: "SECONDARY" },
    { word: "HAULING", tier: "SECONDARY" },
    { word: "HAULER", tier: "SECONDARY" },
    { word: "REMOVE", tier: "SECONDARY" },
    { word: "LOADS", tier: "TERTIARY" },
  ],
  moving: [
    { word: "MOVE", tier: "PRIMARY" },
    { word: "MOVER", tier: "PRIMARY" },
    { word: "MOVERS", tier: "PRIMARY" },
    { word: "MOVING", tier: "PRIMARY" },
    { word: "PACKER", tier: "SECONDARY" },
    { word: "PACKERS", tier: "SECONDARY" },
    { word: "LOAD", tier: "TERTIARY" },
  ],
  legal: [
    { word: "LAW", tier: "PRIMARY" },
    { word: "LAWYER", tier: "PRIMARY" },
    { word: "LAWYERS", tier: "PRIMARY" },
    { word: "LEGAL", tier: "PRIMARY" },
    { word: "ATTORNEY", tier: "SECONDARY" },
    { word: "TRIAL", tier: "SECONDARY" },
    { word: "LITIGATE", tier: "TERTIARY" },
  ],
  dental: [
    { word: "DENTAL", tier: "PRIMARY" },
    { word: "DENTIST", tier: "PRIMARY" },
    { word: "TOOTH", tier: "SECONDARY" },
    { word: "TEETH", tier: "SECONDARY" },
    { word: "SMILE", tier: "SECONDARY" },
    { word: "SMILES", tier: "SECONDARY" },
    { word: "BRACES", tier: "TERTIARY" },
  ],
  auto: [
    { word: "AUTO", tier: "PRIMARY" },
    { word: "CARS", tier: "PRIMARY" },
    { word: "REPAIR", tier: "PRIMARY" },
    { word: "MECHANIC", tier: "SECONDARY" },
    { word: "GARAGE", tier: "SECONDARY" },
    { word: "MOTORS", tier: "SECONDARY" },
    { word: "BRAKES", tier: "SECONDARY" },
    { word: "TIRES", tier: "SECONDARY" },
    { word: "TIRE", tier: "SECONDARY" },
    { word: "PARTS", tier: "TERTIARY" },
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
  const defs = INDUSTRY_KEYWORD_MAP[key];
  if (defs) {
    return {
      primary: defs.filter((d) => d.tier === "PRIMARY").map((d) => d.word),
      industryKey: key,
    };
  }
  const custom = normalizeWord(industry);
  if (custom.length >= 3) return { primary: [custom], industryKey: key };
  return { primary: [], industryKey: key };
}

function tierForWord(
  word: string,
  primaryOverride: Set<string>,
  industryKey?: string,
): KeywordTier {
  if (primaryOverride.has(word)) return "PRIMARY";
  if (!industryKey) return "TERTIARY";
  const defs = INDUSTRY_KEYWORD_MAP[industryKey];
  const hit = defs?.find((d) => normalizeWord(d.word) === word);
  return hit?.tier ?? "TERTIARY";
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

  const custom = (input.customKeywords || [])
    .map((k) => normalizeWord(k))
    .filter((k) => k.length >= 3);
  for (const w of custom) primarySet.add(w);

  const orderedWords: string[] = [];
  const seen = new Set<string>();
  const push = (w: string) => {
    const n = normalizeWord(w);
    if (!n || seen.has(n)) return;
    seen.add(n);
    orderedWords.push(n);
  };

  const industryWords =
    industryKey && INDUSTRY_KEYWORD_MAP[industryKey]
      ? INDUSTRY_KEYWORD_MAP[industryKey].map((d) => d.word)
      : [];

  const allWords = [...industryWords, ...custom];
  allWords.sort((a, b) => b.length - a.length);
  for (const w of allWords) push(w);

  return orderedWords
    .map((word) => {
      const digits = wordToKeypadDigits(word);
      if (digits.length < 3) return null;
      const tier = tierForWord(word, primarySet, industryKey);
      return {
        word,
        digits,
        tier,
        isPrimary: tier === "PRIMARY",
        isSecondary: tier === "SECONDARY",
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
