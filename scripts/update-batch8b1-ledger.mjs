#!/usr/bin/env node
/**
 * Batch 8B-1 ledger status updates — booking setup family
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LEDGER = join(process.cwd(), "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const UPDATES = {
  "3-5": "ABSORBED_CANONICAL_UI",
  "3-6": "ABSORBED_CANONICAL_UI",
  "3-7": "ABSORBED_CANONICAL_UI",
  "3-9": "ABSORBED_CANONICAL_UI",
  "3-10": "ABSORBED_CANONICAL_UI",
  "3-11": "ABSORBED_CANONICAL_UI",
  "3-12": "ABSORBED_CANONICAL_UI",
  "3-15": "RUNTIME_ONLY",
  "3-16": "RUNTIME_ONLY",
  "3-17": "ABSORBED_CANONICAL_UI",
  "3-18": "RUNTIME_ONLY",
  "3-19": "RUNTIME_ONLY",
  "3-20": "ABSORBED_CANONICAL_UI",
  "3-22": "ABSORBED_CANONICAL_UI",
  "2-37": "ABSORBED_CANONICAL_UI",
  "2-25": "ABSORBED_CANONICAL_UI",
  "2-26": "ABSORBED_CANONICAL_UI",
  "2-27": "ABSORBED_CANONICAL_UI",
  "2-29": "ABSORBED_CANONICAL_UI",
  "2-31": "ABSORBED_CANONICAL_UI",
  "2-32": "ABSORBED_CANONICAL_UI",
  "2-33": "ABSORBED_CANONICAL_UI",
  "2-34": "ABSORBED_CANONICAL_UI",
  "2-35": "ABSORBED_CANONICAL_UI",
  "2-20": "ABSORBED_CANONICAL_UI",
  "2-42": "ABSORBED_CANONICAL_UI",
  "4-8": "ABSORBED_CANONICAL_UI",
  "4-9": "ABSORBED_CANONICAL_UI",
  "4-10": "ABSORBED_CANONICAL_UI",
  "2-16": "ALREADY_PRESENT",
  "2-18": "ABSORBED_CANONICAL_UI",
  "2-19": "ABSORBED_CANONICAL_UI",
  "2-22": "ABSORBED_CANONICAL_UI",
  "2-23": "ABSORBED_CANONICAL_UI",
  "2-38": "ABSORBED_CANONICAL_UI",
  "5-2": "ALREADY_PRESENT",
  "5-3": "ABSORBED_CANONICAL_UI",
};

// Placement corrections (column FINAL_CANONICAL_PAGE = index 9)
const PLACEMENT = {
  // payment modes incorrectly on transactions — leave for 8B-6 if any in this batch
};

const raw = readFileSync(LEDGER, "utf8");
const lines = raw.split("\n");
const header = lines[0];
const implIdx = header.split(",").indexOf("IMPL_STATE");
const idIdx = 0;

let count = 0;
const out = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;
  const id = line.split(",")[0];
  if (!UPDATES[id]) return line;
  const cols = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) {
      cols.push(cur);
      cur = "";
    } else cur += ch;
  }
  cols.push(cur);
  cols[implIdx] = UPDATES[id];
  count++;
  return cols.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",");
});

writeFileSync(LEDGER, out.join("\n"));
console.log(`Updated ${count} ledger rows for Batch 8B-1`);
