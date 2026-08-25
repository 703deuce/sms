import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";

/** Customer-safe number snapshot for LLM context — no provider, cost, or internal IDs. */
export type CustomerSafeNumberResult = {
  id: string;
  phoneNumber: string;
  displayNumber: string;
  vanityDisplay?: string;
  displayWord?: string;
  retailPriceCents: number;
  businessMatchScore: number;
  numberQualityScore: number;
  memorabilityLabel?: string;
  businessMatchLabel?: string;
  scoreComponents?: {
    cardBullets?: string[];
    whyReasons?: string[];
    patterns?: string[];
    matchedWords?: string[];
  };
  availability?: string;
};

const FORBIDDEN_KEYS = new Set([
  "provider",
  "providerReference",
  "providerPremium",
  "providerNumberId",
  "providerCost",
  "wholesaleCost",
  "margin",
  "rawProviderResponse",
  "telnyxReservationId",
  "upfrontCost",
  "monthlyCost",
  "apiKey",
  "internalPricingRule",
]);

const POISON_TEXT_PATTERNS = [
  /\btelnyx\b/gi,
  /\btwilio\b/gi,
  /\bwholesale\b/gi,
  /\bprovider\b/gi,
  /\bprovidernumberid\b/gi,
  /\bsystem:\s*reveal\b/gi,
];

function sanitizeCustomerText(text: string | undefined): string | undefined {
  if (!text?.trim()) return text;
  let out = text;
  for (const pattern of POISON_TEXT_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return out.trim() || undefined;
}

function sanitizeCustomerTextList(items: string[] | undefined): string[] | undefined {
  if (!items?.length) return items;
  const cleaned = items
    .map((s) => sanitizeCustomerText(s))
    .filter((s): s is string => Boolean(s));
  return cleaned.length ? cleaned : undefined;
}

export function toCustomerSafeNumberResult(
  result: PremiumNumberProductResult,
): CustomerSafeNumberResult {
  return {
    id: result.phoneNumber,
    phoneNumber: result.phoneNumber,
    displayNumber: result.displayNumber,
    vanityDisplay: sanitizeCustomerText(result.vanityDisplay),
    displayWord: result.displayWord,
    retailPriceCents: result.premiumPriceCents,
    businessMatchScore: result.businessMatchScore,
    numberQualityScore: result.numberQualityScore,
    memorabilityLabel: result.memorabilityLabel,
    businessMatchLabel: result.businessMatchLabel,
    scoreComponents: {
      cardBullets: sanitizeCustomerTextList(result.cardBullets),
      whyReasons: sanitizeCustomerTextList(result.whyReasons),
      patterns: result.patterns,
      matchedWords: result.matchedWords,
    },
    availability: result.availabilityStatus,
  };
}

export function toCustomerSafeNumberResults(
  results: PremiumNumberProductResult[],
): CustomerSafeNumberResult[] {
  return results.map(toCustomerSafeNumberResult);
}

/** Strip sensitive keys from arbitrary client payloads before they reach the model. */
export function stripSensitiveResultPayload(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function assertCustomerSafePayload(payload: unknown): string[] {
  const leaks: string[] = [];
  const json = JSON.stringify(payload).toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\btelnyx\b/, "telnyx"],
    [/\btwilio\b/, "twilio"],
    [/providerreference/, "providerReference"],
    [/providernumberid/, "providerNumberId"],
    [/wholesale/, "wholesale"],
    [/upfrontcost/, "upfrontCost"],
    [/rawprovider/, "rawProvider"],
    [/api[_-]?key/, "apiKey"],
    [/telnyxreservationid/, "telnyxReservationId"],
  ];
  for (const [re, label] of patterns) {
    if (re.test(json)) leaks.push(label);
  }
  return leaks;
}
