#!/usr/bin/env node
/**
 * Batch 8B-8 — Public Booking completion ledger updates.
 * Run: node scripts/update-batch8b8-ledger.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LEDGER = join(process.cwd(), "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const ROW_IDS = [
  "2-4",
  "5-1",
  "5-2",
  "5-3",
  "5-4",
  "5-5",
  "5-6",
  "5-24",
  "5-25",
  "2-24",
  "5-28",
  "7-2",
  "5-32",
];

const NOTE = "Batch 8B-8 public booking completion (STATIC_PASS implementation)";

function main() {
  const raw = readFileSync(LEDGER, "utf8");
  const lines = raw.split(/\r?\n/);
  let updated = 0;
  const out = lines.map((line, index) => {
    if (index === 0 || !line.trim()) return line;
    const id = line.split(",")[0];
    if (!ROW_IDS.includes(id)) return line;
    updated++;
    let next = line.replace(/,UA_PENDING,/, ",STATIC_PASS,");
    if (!next.endsWith(",")) next += ",";
    if (!next.includes("Batch 8B-8")) {
      next = next.replace(/,\s*$/, `,${NOTE},`);
    }
    return next;
  });
  writeFileSync(LEDGER, out.join("\n") + (raw.endsWith("\n") ? "\n" : ""));
  console.log(`Updated ${updated} ledger rows for Batch 8B-8`);
}

main();
