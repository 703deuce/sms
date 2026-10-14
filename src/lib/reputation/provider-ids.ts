/** Strip angle brackets Brevo often wraps around transactional message ids. */
export function normalizeProviderMessageId(id: string | null | undefined): string {
  return String(id ?? "")
    .trim()
    .replace(/^<|>$/g, "");
}

/** Lookup variants for rows written before normalization. */
export function providerMessageIdVariants(id: string): string[] {
  const normalized = normalizeProviderMessageId(id);
  if (!normalized) return [];
  const variants = [normalized];
  if (!normalized.startsWith("<")) variants.push(`<${normalized}>`);
  return [...new Set(variants)];
}

/** One-off + campaign statuses that mean “already contacted successfully”. */
export const SUCCESSFUL_SEND_STATUSES = ["sent", "delivered", "clicked", "completed"] as const;
