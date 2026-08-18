import { sanitizeAssistantMessage } from "./controller";

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\btelnyx\b/gi, label: "telnyx" },
  { pattern: /\btwilio\b/gi, label: "twilio" },
  { pattern: /\bwholesale\b/gi, label: "wholesale" },
  { pattern: /\bacquisition cost\b/gi, label: "acquisition cost" },
  { pattern: /\bprovider[_ ]?cost\b/gi, label: "provider cost" },
  { pattern: /\bprovider[_ ]?number[_ ]?id\b/gi, label: "providerNumberId" },
  { pattern: /\bproviderreference\b/gi, label: "providerReference" },
  { pattern: /\bupfront[_ ]?cost\b/gi, label: "upfrontCost" },
  { pattern: /\bmonthly[_ ]?cost\b/gi, label: "monthlyCost" },
  { pattern: /\bmargin\b/gi, label: "margin" },
  { pattern: /\bsystem prompt\b/gi, label: "system prompt" },
  { pattern: /\bapi[_ ]?key\b/gi, label: "api key" },
  { pattern: /\bsk-[a-zA-Z0-9]{10,}/g, label: "api token" },
  { pattern: /\bAKIA[0-9A-Z]{16}/g, label: "aws key" },
  { pattern: /\bprovider response\b/gi, label: "provider response" },
  { pattern: /\braw (?:search|provider|inventory)\b/gi, label: "raw payload" },
  { pattern: /\bhidden (?:fields|instructions|metadata)\b/gi, label: "hidden data" },
  { pattern: /\bdeveloper mode\b/gi, label: "developer mode" },
];

const REDACTED = "[information not available to customers]";

/**
 * Server-side backup sanitizer for all customer-facing AI text.
 * Redacts provider names, wholesale costs, secrets, and system-internals.
 */
export function sanitizeCustomerAiOutput(
  message: string,
  allowedPhones: string[] = [],
  allowedDisplays: string[] = [],
): string {
  let out = sanitizeAssistantMessage(message, allowedPhones, allowedDisplays);
  for (const { pattern } of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

export function detectSensitiveLeaks(text: string): string[] {
  const hits: string[] = [];
  for (const { pattern, label } of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) hits.push(label);
    pattern.lastIndex = 0;
  }
  return hits;
}
