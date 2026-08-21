#!/usr/bin/env node
import { existsSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import { syncMarketplaceBillingCatalog } from "../src/lib/payments/marketplace-billing-catalog.ts";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path });
}

async function main() {
  const catalog = await syncMarketplaceBillingCatalog();
  console.log(JSON.stringify({ ok: true, catalog }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
