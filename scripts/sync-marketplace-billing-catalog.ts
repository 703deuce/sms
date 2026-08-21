#!/usr/bin/env node
import { syncMarketplaceBillingCatalog } from "../src/lib/payments/marketplace-billing-catalog.ts";

async function main() {
  const catalog = await syncMarketplaceBillingCatalog();
  console.log(JSON.stringify({ ok: true, catalog }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
