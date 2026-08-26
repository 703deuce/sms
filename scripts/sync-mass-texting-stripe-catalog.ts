#!/usr/bin/env node
/**
 * Idempotent Mass Texting Stripe catalog sync (reads canonical pricing from code).
 * Run: npx tsx scripts/sync-mass-texting-stripe-catalog.ts [--dry-run] [--write-ids]
 */
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import {
  catalogToTsExport,
  syncMassTextingCatalogToStripe,
} from "../src/lib/mass-texting/stripe-catalog-sync.ts";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path });
}

const dryRun = process.argv.includes("--dry-run");
const writeIds = process.argv.includes("--write-ids");

async function main() {
  const result = await syncMassTextingCatalogToStripe({ dryRun });
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: result.mode,
        created: result.created,
        reused: result.reused,
        warnings: result.warnings,
        catalog: result.catalog,
      },
      null,
      2,
    ),
  );

  if (writeIds && !dryRun) {
    const file =
      result.mode === "test"
        ? "src/lib/mass-texting/stripe-catalog-ids-test.ts"
        : "src/lib/mass-texting/stripe-catalog-ids-live.ts";
    writeFileSync(resolve(process.cwd(), file), catalogToTsExport(result.mode, result.catalog));
    console.log(`Wrote ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
