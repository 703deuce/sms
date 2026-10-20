import { createHash } from "crypto";

const SENSITIVE_PATH_SUFFIXES = [
  "openingGreeting",
  "connectionGreetingText",
  "websiteUrl",
  "transferDestinationPhone",
  "transferDestinations",
  "phoneNumberE164",
  "outboundSmsE164",
  "calendarEmail",
  "bookingLinkUrl",
  "guardrails",
  "knowledgeItems",
  "qualificationRules",
  "compiledPrompt",
  "agentJobInstructions",
  "businessDescription",
  "afterHoursNotificationRecipients",
];

const SENSITIVE_PATH_INCLUDES = [
  ".phoneE164",
  ".email",
  ".summary",
  ".label",
  "Password",
  "Secret",
  "Token",
];

export function fingerprintValue(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return `fp_${createHash("sha256").update(raw).digest("hex").slice(0, 12)}`;
}

export function isSensitiveFieldPath(path: string): boolean {
  const leaf = path.split(".").pop() ?? path;
  if (SENSITIVE_PATH_SUFFIXES.includes(leaf)) return true;
  return SENSITIVE_PATH_INCLUDES.some((frag) => path.includes(frag));
}

export function redactFieldValue(path: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isSensitiveFieldPath(path)) {
    if (typeof value === "string" && value.length > 200) {
      return `${value.slice(0, 80)}…${fingerprintValue(value)}`;
    }
    return value;
  }
  if (typeof value === "string") {
    if (!value.trim()) return "";
    return `<redacted len=${value.length} ${fingerprintValue(value)}>`;
  }
  if (Array.isArray(value)) {
    return `<redacted array len=${value.length} ${fingerprintValue(value)}>`;
  }
  if (typeof value === "object") {
    return `<redacted object ${fingerprintValue(value)}>`;
  }
  return "<redacted>";
}
