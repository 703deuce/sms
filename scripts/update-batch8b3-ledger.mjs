#!/usr/bin/env node
/**
 * Batch 8B-3 ledger status updates — operations family absorption
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LEDGER = join(process.cwd(), "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const UPDATES = {
  "2-1": "ABSORBED_CANONICAL_UI",
  "2-2": "ABSORBED_CANONICAL_UI",
  "2-3": "ABSORBED_CANONICAL_UI",
  "2-4": "ABSORBED_CANONICAL_UI",
  "2-5": "ABSORBED_CANONICAL_UI",
  "2-6": "ABSORBED_CANONICAL_UI",
  "2-7": "ABSORBED_CANONICAL_UI",
  "2-8": "RUNTIME_UI_EFFECT",
  "2-9": "ABSORBED_CANONICAL_UI",
  "2-10": "ABSORBED_CANONICAL_UI",
  "2-11": "ABSORBED_CANONICAL_UI",
  "2-12": "ABSORBED_CANONICAL_UI",
  "2-13": "ABSORBED_CANONICAL_UI",
  "2-14": "ABSORBED_CANONICAL_UI",
  "2-15": "ABSORBED_CANONICAL_UI",
  "2-16": "ABSORBED_CANONICAL_UI",
  "2-17": "ABSORBED_CANONICAL_UI",
  "2-18": "ABSORBED_CANONICAL_UI",
  "3-1": "ABSORBED_CANONICAL_UI",
  "3-2": "ABSORBED_CANONICAL_UI",
  "3-3": "ABSORBED_CANONICAL_UI",
  "4-1": "ABSORBED_CANONICAL_UI",
  "4-2": "ABSORBED_CANONICAL_UI",
  "5-1": "ABSORBED_CANONICAL_UI",
  "5-2": "ABSORBED_CANONICAL_UI",
  "5-3": "ABSORBED_CANONICAL_UI",
  "5-4": "ABSORBED_CANONICAL_UI",
  "5-5": "ABSORBED_CANONICAL_UI",
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
console.log(`Updated ${count} ledger rows for Batch 8B-3`);
