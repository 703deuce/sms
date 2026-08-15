import { normalizeWord } from "./keypad";

const FILLER_WORDS = new Set([
  "LLC",
  "INC",
  "THE",
  "COMPANY",
  "SERVICES",
  "SERVICE",
  "AND",
  "CO",
  "CORP",
  "CORPORATION",
  "LTD",
]);

/** Deterministic business-name → optional search keywords (no LLM). */
export function extractBusinessNameKeywords(businessName?: string): string[] {
  if (!businessName?.trim()) return [];
  const tokens = businessName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => normalizeWord(t))
    .filter((t) => t.length >= 3 && !FILLER_WORDS.has(t));
  return [...new Set(tokens)];
}

/** Try to map free-text keywords to a known industry key. */
export function inferIndustryFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  const rules: Array<{ industry: string; hints: string[] }> = [
    { industry: "roofing", hints: ["roof", "roofer", "shingle"] },
    { industry: "plumbing", hints: ["plumb", "pipe", "drain"] },
    { industry: "hvac", hints: ["hvac", "heat", "cool", "ac "] },
    { industry: "lawn_care", hints: ["lawn", "mow", "grass", "yard"] },
    { industry: "junk_removal", hints: ["junk", "haul", "trash"] },
    { industry: "moving", hints: ["move", "mover", "reloc"] },
    { industry: "legal", hints: ["law", "legal", "attorney"] },
    { industry: "dental", hints: ["dental", "dentist", "tooth", "smile"] },
    { industry: "auto", hints: ["auto", "car", "garage", "mechanic"] },
  ];
  for (const rule of rules) {
    if (rule.hints.some((h) => lower.includes(h))) return rule.industry;
  }
  return undefined;
}
