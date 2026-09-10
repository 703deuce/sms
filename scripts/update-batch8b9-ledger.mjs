#!/usr/bin/env node
/**
 * Batch 8B-9 — Customer Portal + Self-Service completion ledger updates.
 * Run: node scripts/update-batch8b9-ledger.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LEDGER = join(process.cwd(), "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const ROW_IDS = [
  "5-18",
  "7-1",
  "7-2",
  "7-3",
  "7-4",
  "7-5",
  "7-6",
  "7-7",
  "7-8",
  "7-9",
  "7-10",
  "7-11",
  "7-12",
  "7-13",
  "7-14",
  "7-15",
  "7-16",
  "7-17",
  "7-18",
  "7-19",
  "7-20",
  "8-4",
  "8-9",
  "8-16",
  "8-17",
  "8-29",
];

const NOTE = "Batch 8B-9 customer portal completion (STATIC_PASS implementation)";

function main() {
  const raw = readFileSync(LEDGER, "utf8");
  const lines = raw.split(/\r?\n/);
  let updated = 0;
  const out = lines.map((line, index) => {
    if (index === 0 || !line.trim()) return line;
    const id = line.split(",")[0];
    if (!ROW_IDS.includes(id)) return line;
    updated++;
    let next = line
      .replace(/,UA_PENDING,/, ",STATIC_PASS,")
      .replace(/,PORTAL_WAVE_PENDING,/, ",STATIC_PASS,")
      .replace(/,metadata tokens,/, ",STATIC_PASS,");
    if (!next.endsWith(",")) next += ",";
    if (!next.includes("Batch 8B-9")) {
      next = next.replace(/,\s*$/, `,${NOTE},`);
    }
    return next;
  });
  writeFileSync(LEDGER, out.join("\n") + (raw.endsWith("\n") ? "\n" : ""));
  console.log(`Updated ${updated} ledger rows for Batch 8B-9`);
}

main();
