/**
 * Apply all supabase/migrations/*.sql files in chronological order.
 * Skips idempotent "already exists" errors; stops on unexpected failures unless --continue.
 *
 * Usage:
 *   npx tsx scripts/apply-all-supabase-migrations.ts
 *   npx tsx scripts/apply-all-supabase-migrations.ts --continue
 */
import { readdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

const root = resolve(process.cwd(), "supabase/migrations");
const continueOnError = process.argv.includes("--continue");

const files = readdirSync(root)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let applied = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  const path = join(root, file);
  console.log(`\n=== ${file} ===`);
  const res = spawnSync("npx", ["tsx", "scripts/apply-sql-migration.ts", path], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status === 0) {
    applied += 1;
  } else if (continueOnError) {
    failed += 1;
    console.warn(`WARN: ${file} had failures (continuing)`);
  } else {
    console.error(`Stopped on ${file}. Re-run with --continue to proceed past failures.`);
    process.exit(res.status || 1);
  }
}

console.log(`\nDone. Files processed: ${files.length}. Success batches: ${applied}. Failed batches: ${failed}.`);
