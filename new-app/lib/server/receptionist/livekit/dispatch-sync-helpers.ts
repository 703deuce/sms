import type { SIPDispatchRuleInfo as SdkDispatchRuleInfo } from "livekit-server-sdk";

const DISPATCH_PREFIX = "transovo-did-dispatch-";

export function dispatchRuleNameForDid(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `${DISPATCH_PREFIX}${digits || "unknown"}`;
}

export function e164VariantsForDispatch(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const plus = digits ? `+${digits}` : e164;
  const e164Norm =
    e164.startsWith("+") ? plus : digits.length === 10 ? `+1${digits}` : plus;
  return [...new Set([e164Norm, e164, digits, plus].filter(Boolean))];
}

export function ruleDispatchCoversDid(
  rule: SdkDispatchRuleInfo,
  e164: string,
  trunkId: string,
): boolean {
  const trunks = rule.trunkIds || [];
  if (!trunks.includes(trunkId)) return false;
  const nums = rule.numbers || [];
  if (nums.length === 0) return true;
  const variants = e164VariantsForDispatch(e164);
  return variants.some((v) => nums.includes(v));
}

/** Canonical per-DID rule for Voice V3 receptionist — never the shared inbound rule. */
export function findPerDidDispatchRule(
  rules: SdkDispatchRuleInfo[],
  e164: string,
): SdkDispatchRuleInfo | null {
  return rules.find((r) => r.name === dispatchRuleNameForDid(e164)) || null;
}

export function isDuplicateDispatchRuleError(message: string): boolean {
  return /already exists in dispatch rule/i.test(message);
}

export function numbersWithoutE164(numbers: string[], e164: string): string[] {
  const variants = new Set(e164VariantsForDispatch(e164));
  return numbers.filter((n) => !variants.has(n));
}
