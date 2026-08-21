import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { listMarketplaceBillingCatalog } from "@/lib/payments/marketplace-billing-catalog";

type CatalogRow = Awaited<ReturnType<typeof listMarketplaceBillingCatalog>>[number];

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(auth.session, url.searchParams.get("workspaceId") ?? undefined);
    void workspaceId;
    const catalog = await listMarketplaceBillingCatalog();
    return NextResponse.json({
      catalog: catalog.map((row: CatalogRow) => ({
        productKey: row.productKey,
        displayName: row.displayName,
        description: row.description,
        amountCents: row.amountCents,
        currency: row.currency,
        billingInterval: row.billingInterval,
        includedUsageMinutes: row.includedUsageMinutes,
        monthlyPriceLabel: `$${(row.amountCents / 100).toFixed(2)}/month`,
      })),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
