#!/usr/bin/env node
/**
 * Batch 8B-2 ledger status updates — money + access products
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LEDGER = join(process.cwd(), "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const UPDATES = {
  "8-1": "ABSORBED_CANONICAL_UI",
  "8-2": "ABSORBED_CANONICAL_UI",
  "8-3": "ABSORBED_CANONICAL_UI",
  "8-4": "ABSORBED_CANONICAL_UI",
  "8-5": "ABSORBED_CANONICAL_UI",
  "8-6": "ABSORBED_CANONICAL_UI",
  "8-7": "ABSORBED_CANONICAL_UI",
  "8-8": "ABSORBED_CANONICAL_UI",
  "8-9": "ABSORBED_CANONICAL_UI",
  "8-10": "ABSORBED_CANONICAL_UI",
  "8-11": "ABSORBED_CANONICAL_UI",
  "8-12": "ABSORBED_CANONICAL_UI",
  "8-13": "ABSORBED_CANONICAL_UI",
  "8-14": "ABSORBED_CANONICAL_UI",
  "8-15": "ABSORBED_CANONICAL_UI",
  "5-16": "PUBLIC_WAVE_PENDING",
  "5-31": "PUBLIC_WAVE_PENDING",
  "7-12": "PORTAL_WAVE_PENDING",
  "7-13": "PORTAL_WAVE_PENDING",
  "7-14": "PORTAL_WAVE_PENDING",
  "7-15": "PORTAL_WAVE_PENDING",
};

const raw = readFileSync(LEDGER, "utf8");
const lines = raw.split("\n");
const header = lines[0];
const implIdx = header.split(",").indexOf("IMPL_STATE");
const idIdx = 0;

let count = 0;
const out = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;
  const cols = line.split(",");
  const id = cols[idIdx];
  if (UPDATES[id] && implIdx >= 0) {
    cols[implIdx] = UPDATES[id];
    count++;
    return cols.join(",");
  }
  return line;
});

writeFileSync(LEDGER, out.join("\n"));
console.log(`Updated ${count} ledger rows for Batch 8B-2`);
