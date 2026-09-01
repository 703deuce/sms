/** Provider cost per page for admin analytics (USD). Telnyx ~$0.007/page — configurable. */
export function faxProviderCostCentsPerPage(): number {
  const raw = Number(process.env.FAX_PROVIDER_COST_CENTS_PER_PAGE);
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
  return 1; // $0.01 default estimate for margin tracking
}

export type FaxPageAccounting = {
  documentPages: number;
  billablePages: number;
  providerCostCents: number;
};

/**
 * Transovo bills 1 document page = 1 customer billable page.
 * Transmission duration is NOT exposed to customers.
 */
export function computeFaxPageAccounting(pageCount: number): FaxPageAccounting {
  const pages = Math.max(1, Math.round(pageCount));
  return {
    documentPages: pages,
    billablePages: pages,
    providerCostCents: pages * faxProviderCostCentsPerPage(),
  };
}

export function mergePageAccountingIntoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  accounting: FaxPageAccounting,
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    documentPages: accounting.documentPages,
    billablePages: accounting.billablePages,
    providerCostCents: accounting.providerCostCents,
  };
}

export function readPageAccounting(metadata: unknown): FaxPageAccounting | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const documentPages = Number(m.documentPages ?? m.estimatedPages ?? 0);
  const billablePages = Number(m.billablePages ?? documentPages);
  if (!documentPages && !billablePages) return null;
  return {
    documentPages: documentPages || billablePages,
    billablePages: billablePages || documentPages,
    providerCostCents: Number(m.providerCostCents || 0),
  };
}
