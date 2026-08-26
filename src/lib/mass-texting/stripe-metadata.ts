type StripeMetadata = Record<string, string | undefined>;

function asMetadata(value: unknown): StripeMetadata {
  if (!value || typeof value !== "object") return {};
  const out: StripeMetadata = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

/**
 * Merge Stripe metadata sources. Later sources win so invoice metadata can
 * override subscription metadata when both are present.
 */
export function mergeStripeMetadata(...sources: unknown[]): StripeMetadata {
  const out: StripeMetadata = {};
  for (const source of sources) {
    Object.assign(out, asMetadata(source));
  }
  return out;
}

/**
 * Renewal invoices often have empty `invoice.metadata`. Checkout copies
 * `product=mass_texting` onto the subscription instead.
 */
export function massTextingMetadataFromInvoice(invoice: {
  metadata?: StripeMetadata | null;
  subscription?: string | { id?: string; metadata?: StripeMetadata | null } | null;
  subscription_details?: { metadata?: StripeMetadata | null } | null;
}): StripeMetadata {
  const sub = invoice.subscription;
  const subMd = sub && typeof sub === "object" ? sub.metadata : null;
  return mergeStripeMetadata(subMd, invoice.subscription_details?.metadata, invoice.metadata);
}
