import "server-only";

import { FAX_OVERAGE_CENTS_PER_PAGE } from "@/lib/products/platform-billing-catalog-definitions";
import { getFaxUsageSnapshot } from "./fax-usage";
import { computeFaxPageAccounting } from "./fax-pages";
import { estimatePdfPageCount } from "./fax-validation";

export async function estimateFaxSend(input: {
  workspaceId: string;
  documentBytes: Buffer;
}) {
  const usage = await getFaxUsageSnapshot(input.workspaceId);
  const estimatedPages = (await estimatePdfPageCount(input.documentBytes)) || 1;
  const accounting = computeFaxPageAccounting(estimatedPages);

  const remaining = usage.pagesRemaining;
  const overagePages = Math.max(0, accounting.billablePages - remaining);
  const overageCents = overagePages * FAX_OVERAGE_CENTS_PER_PAGE;

  return {
    documentPages: accounting.documentPages,
    billablePages: accounting.billablePages,
    pagesIncluded: usage.pagesIncluded,
    pagesUsed: usage.pagesUsed,
    pagesRemaining: remaining,
    overagePages,
    overageCents,
    overageRateCents: FAX_OVERAGE_CENTS_PER_PAGE,
    requiresConfirmation: overagePages > 0,
    message:
      overagePages > 0
        ? `This fax contains ${accounting.documentPages} page(s). You have ${remaining} included page(s) remaining. ${overagePages} page(s) will be billed at $${(FAX_OVERAGE_CENTS_PER_PAGE / 100).toFixed(2)}/page. Estimated overage: $${(overageCents / 100).toFixed(2)}.`
        : `This fax contains ${accounting.documentPages} page(s). You have ${remaining} included page(s) remaining.`,
  };
}
