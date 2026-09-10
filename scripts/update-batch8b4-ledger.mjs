#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";

const path = "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv";
const rows = readFileSync(path, "utf8").trim().split("\n");
const header = rows[0];

const updates = {
  "11-2": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 reminders SMS" },
  "11-3": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 reminders email" },
  "11-4": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 ICS toggle" },
  "11-5": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 test send" },
  "11-6": { IMPL_STATE: "RUNTIME_UI_EFFECT", NEXT_ACTION: "Batch 8B-4 email tracking helper" },
  "11-8": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 voice channel absorbed" },
  "11-9": { IMPL_STATE: "RUNTIME_UI_EFFECT", NEXT_ACTION: "Batch 8B-4 voice retry helper" },
  "11-11": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 SMS consent notice" },
  "12-4": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 workflow test" },
  "12-5": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 workflow preview" },
  "12-6": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 activity link" },
  "12-7": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 unknown SMS in activity" },
  "12-8": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 time triggers" },
  "12-9": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 before/after triggers" },
  "10-10": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 recall automation route" },
  "10-12": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 no-show automation route" },
  "10-13": { IMPL_STATE: "RUNTIME_UI_EFFECT", NEXT_ACTION: "Batch 8B-4 scan runtime only" },
  "15-2": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 legacy rules in routing forms" },
  "15-3": { IMPL_STATE: "ABSORBED_CANONICAL_UI", NEXT_ACTION: "Batch 8B-4 routing presets" },
  "15-4": { IMPL_STATE: "ALREADY_PRESENT", NEXT_ACTION: "Batch 8B-4 public routing preserved" },
};

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const cols = parseCsvLine(header);
const idIdx = cols.indexOf("FEATURE_ID");
const implIdx = cols.indexOf("IMPL_STATE");
const nextIdx = cols.indexOf("NEXT_ACTION");

let changed = 0;
const out = [header];
for (const line of rows.slice(1)) {
  const parts = parseCsvLine(line);
  const id = parts[idIdx];
  const patch = updates[id];
  if (patch) {
    if (patch.IMPL_STATE) parts[implIdx] = patch.IMPL_STATE;
    if (patch.NEXT_ACTION) parts[nextIdx] = patch.NEXT_ACTION;
    changed++;
  }
  out.push(parts.join(","));
}

writeFileSync(path, out.join("\n") + "\n");
console.log(`Updated ${changed} ledger rows for Batch 8B-4`);
