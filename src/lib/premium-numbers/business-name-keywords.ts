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
