export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  return raw.trim();
}

export function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(services|service|repair|repairs)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFaqQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(normalizeServiceName(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeServiceName(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export function isSemanticDuplicateService(a: string, b: string): boolean {
  const na = normalizeServiceName(a);
  const nb = normalizeServiceName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return tokenOverlapRatio(a, b) >= 0.75;
}

export function isSemanticDuplicateFaq(a: string, b: string): boolean {
  const na = normalizeFaqQuestion(a);
  const nb = normalizeFaqQuestion(b);
  if (na === nb) return true;
  return tokenOverlapRatio(na, nb) >= 0.8;
}
