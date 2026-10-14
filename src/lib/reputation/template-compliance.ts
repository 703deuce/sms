/** Soft compliance warnings for review request copy. Never auto-rewrite user content. */

const SUSPICIOUS_PATTERNS: Array<{ id: string; re: RegExp; warning: string }> = [
  {
    id: "five_star_only",
    re: /\b(five[-\s]?star|5[-\s]?star)\b/i,
    warning: "Avoid asking only for five-star reviews — request honest feedback instead.",
  },
  {
    id: "happy_only",
    re: /\bonly\s+(review|leave\s+a\s+review)\s+if\s+you\s+(are\s+)?happy\b/i,
    warning: "Do not filter reviewers by satisfaction. Review gating is not allowed.",
  },
  {
    id: "incentive_positive",
    re: /\b(discount|gift\s*card|free|\$)\b.*\b(positive|5[-\s]?star|five[-\s]?star)\b|\b(positive|5[-\s]?star|five[-\s]?star)\b.*\b(discount|gift\s*card|free|\$)\b/i,
    warning: "Incentives tied to a positive review are not allowed.",
  },
];

export function validateReviewTemplateLanguage(body: string): string[] {
  const warnings: string[] = [];
  for (const rule of SUSPICIOUS_PATTERNS) {
    if (rule.re.test(body)) warnings.push(rule.warning);
  }
  return warnings;
}

export const TEMPLATE_TOKENS = [
  "first_name",
  "last_name",
  "business_name",
  "review_link",
  "review_button",
  "location_name",
  "full_name",
  "customer_name",
  "service_type",
  "service_name",
  "appointment_date",
  "sender_name",
  "unsubscribe_link",
] as const;

export function findUnknownTemplateTokens(body: string): string[] {
  const found = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const key = m[1];
    if (!TEMPLATE_TOKENS.includes(key as (typeof TEMPLATE_TOKENS)[number])) {
      found.add(key);
    }
  }
  return [...found];
}
