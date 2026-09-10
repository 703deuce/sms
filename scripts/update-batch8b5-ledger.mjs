#!/usr/bin/env node
/**
 * Batch 8B-5 ledger status updates — Contacts, Customer Data, POS absorption.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = join(root, "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const updates = {
  "2-39": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: Contact Detail → Booking Access" },
  "2-40": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: general segments on /contacts/segments; recall presets remain appointment-segments" },
  "8-21": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", FINAL_CANONICAL_PAGE: "/contacts/[id]", FINAL_SECTION: "Payments & Account Credit", NOTES: "Batch 8B-5: Account credit on Contact Detail + POS apply" },
  "8-23": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: POS cart extended with coupons, credit, recent sales" },
  "8-24": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: mixed cart + coupon preview + account credit checkout" },
  "19-3": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: Household panel on Contact Detail" },
  "19-4": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: Merge modal on Contacts list + Contact Detail" },
  "19-5": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: Fields admin + values on Contact Detail + import mapping" },
  "19-8": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-5: Import wizard custom-field mapping + contextual create" },
  "2-30": { FINAL_CANONICAL_PAGE: "/appointments", FINAL_SECTION: "Operations / approval queue", IMPL_STATE: "RUNTIME_UI_EFFECT", NOTES: "Batch 8B-5 correction: NOT POS" },
  "2-36": { FINAL_CANONICAL_PAGE: "/appointments/[id]", FINAL_SECTION: "Attribution", IMPL_STATE: "RUNTIME_UI_EFFECT", NOTES: "Batch 8B-5 correction: NOT POS" },
  "4-11": { FINAL_CANONICAL_PAGE: "/appointments/types", FINAL_SECTION: "Rooms & Equipment runtime", IMPL_STATE: "RUNTIME_UI_EFFECT", NOTES: "Batch 8B-5 correction: runtime only, NOT POS control" },
  "2-5": { FINAL_CANONICAL_PAGE: "/appointments/types", FINAL_SECTION: "Display order", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-5 correction: NOT POS" },
  "2-6": { FINAL_CANONICAL_PAGE: "/appointments/types", FINAL_SECTION: "Booking questions", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-5 correction: NOT POS" },
  "2-41": { FINAL_CANONICAL_PAGE: "/appointments/types", FINAL_SECTION: "Policies / terms", IMPL_STATE: "RUNTIME_UI_EFFECT", NOTES: "Batch 8B-5 correction: NOT POS" },
};

const raw = readFileSync(ledgerPath, "utf8");
const lines = raw.split(/\r?\n/);
const header = lines[0].split(",");
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

let changed = 0;
const out = lines.map((line, lineNo) => {
  if (lineNo === 0 || !line.trim()) return line;
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
  const id = cols[idx.FEATURE_ID];
  const patch = updates[id];
  if (!patch) return line;
  changed++;
  for (const [key, val] of Object.entries(patch)) {
    if (idx[key] != null) cols[idx[key]] = val;
  }
  return cols.map((c) => (c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c)).join(",");
});

writeFileSync(ledgerPath, out.join("\n"));
console.log(`Updated ${changed} ledger rows for Batch 8B-5.`);
