import type { SIPDispatchRuleInfo as SdkDispatchRuleInfo } from "livekit-server-sdk";

const DISPATCH_PREFIX = "transovo-did-dispatch-";

export function dispatchRuleNameForDid(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `${DISPATCH_PREFIX}${digits || "unknown"}`;
}

function e164LookupVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const plus = digits ? `+${digits}` : e164;
  const e164Norm =
    e164.startsWith("+") ? plus : digits.length === 10 ? `+1${digits}` : plus;
  return [...new Set([e164Norm, e164, digits, plus].filter(Boolean))];
}

function ruleCoversDidOnTrunk(
  rule: SdkDispatchRuleInfo,
  e164: string,
  trunkId: string,
): boolean {
  const trunks = rule.trunkIds || [];
  if (!trunks.includes(trunkId)) return false;
  const nums = rule.numbers || [];
  if (nums.length === 0) return true;
  const variants = e164LookupVariants(e164);
  return variants.some((v) => nums.includes(v));
}

export function findDispatchRuleForDid(
  rules: SdkDispatchRuleInfo[],
  e164: string,
  trunkId: string,
): SdkDispatchRuleInfo | null {
  const byName = rules.find((r) => r.name === dispatchRuleNameForDid(e164));
  if (byName) return byName;
  return rules.find((r) => ruleCoversDidOnTrunk(r, e164, trunkId)) || null;
}

export function isDuplicateDispatchRuleError(message: string): boolean {
  return /already exists in dispatch rule/i.test(message);
}

export function e164VariantsForDispatch(e164: string): string[] {
  return e164LookupVariants(e164);
}
