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
    { industry: "electrician", hints: ["electric", "electrician", "eletric", "eletrican", "wiring"] },
    { industry: "real_estate", hints: ["real estate", "realtor", "property"] },
    { industry: "fitness", hints: ["fitness", "gym", "workout"] },
    { industry: "healthcare", hints: ["health", "healthcare", "medical", "clinic"] },
    { industry: "technology", hints: ["tech", "technology", "software", "saas"] },
    { industry: "ecommerce", hints: ["e-commerce", "ecommerce", "online store", "shop"] },
    { industry: "pool_services", hints: ["pool", "spa"] },
    { industry: "roofing", hints: ["roof", "roofer", "shingle"] },
    { industry: "plumbing", hints: ["plumb", "plumber", "pipe", "drain"] },
    { industry: "hvac", hints: ["hvac", "heat", "cool", "ac "] },
    { industry: "lawn_care", hints: ["lawn", "mow", "grass", "yard"] },
    { industry: "junk_removal", hints: ["junk", "haul", "trash"] },
    { industry: "moving", hints: ["move", "mover", "reloc"] },
    { industry: "legal", hints: ["law", "legal", "attorney"] },
    { industry: "dental", hints: ["dental", "dentist", "tooth", "smile"] },
    { industry: "auto", hints: ["auto", "car", "garage", "mechanic"] },
  ];
  for (const rule of rules) {
    if (
      rule.hints.some((h) => {
        if (h.includes(" ")) return lower.includes(h);
        const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
      })
    ) {
      return rule.industry;
    }
  }
  return undefined;
}
