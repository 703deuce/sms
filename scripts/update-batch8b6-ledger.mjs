#!/usr/bin/env node
/**
 * Batch 8B-6 ledger status updates — Payments, Reporting, Platform Settings.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = join(root, "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const updates = {
  "1-5": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: setup checklist derived from real config" },
  "1-6": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: global search wired to backend" },
  "2-11": { FINAL_CANONICAL_PAGE: "/appointments/types", FINAL_SECTION: "Pricing & Access", IMPL_STATE: "RUNTIME_UI_EFFECT", NOTES: "Batch 8B-6 correction: NOT Transactions" },
  "5-18": { FINAL_CANONICAL_PAGE: "CUSTOMER_PORTAL", FINAL_SECTION: "Saved payment methods", IMPL_STATE: "PORTAL_WAVE_PENDING", NOTES: "Batch 8B-6 correction: NOT Transactions admin" },
  "5-26": { FINAL_CANONICAL_PAGE: "PUBLIC_BOOKING", FINAL_SECTION: "Payment step", IMPL_STATE: "PUBLIC_WAVE_PENDING", NOTES: "Batch 8B-6: execution in public booking" },
  "5-27": { FINAL_CANONICAL_PAGE: "PUBLIC_BOOKING", FINAL_SECTION: "Payment step", IMPL_STATE: "PUBLIC_WAVE_PENDING", NOTES: "Batch 8B-6: execution in public booking" },
  "7-16": { FINAL_CANONICAL_PAGE: "CUSTOMER_PORTAL", FINAL_SECTION: "Payment history", IMPL_STATE: "PORTAL_WAVE_PENDING", NOTES: "Batch 8B-6 correction" },
  "7-18": { FINAL_CANONICAL_PAGE: "CUSTOMER_PORTAL", FINAL_SECTION: "Saved payment methods", IMPL_STATE: "PORTAL_WAVE_PENDING", NOTES: "Batch 8B-6 correction" },
  "8-27": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: canonical /payments/invoices" },
  "8-28": { FINAL_CANONICAL_PAGE: "PUBLIC_BOOKING", FINAL_SECTION: "Payment", IMPL_STATE: "PUBLIC_WAVE_PENDING", NOTES: "Batch 8B-6 correction" },
  "8-29": { FINAL_CANONICAL_PAGE: "CUSTOMER_PORTAL", FINAL_SECTION: "Saved payment methods", IMPL_STATE: "PORTAL_WAVE_PENDING", NOTES: "Batch 8B-6 correction" },
  "8-30": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: refund modal full/partial/wallet" },
  "8-31": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: original method refund" },
  "8-32": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: account credit refund destination" },
  "8-34": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: enriched transaction list/detail" },
  "16-1": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: real analytics API" },
  "16-2": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6" },
  "16-3": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6" },
  "16-4": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: workflow run metrics" },
  "16-5": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: ReportsHub" },
  "16-6": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: service-booking report absorbed" },
  "16-7": { IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: CSV export on reports API" },
  "16-8": { IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: schedule card wired" },
  "17-5": { FINAL_CANONICAL_PAGE: "/integrations/payments", FINAL_SECTION: "Stripe Connect", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-6 correction: NOT Transactions" },
  "17-6": { FINAL_CANONICAL_PAGE: "/integrations/payments", FINAL_SECTION: "Square", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-6 correction: NOT Transactions" },
  "18-3": { FINAL_CANONICAL_PAGE: "/settings/users", FINAL_SECTION: "Team / Security", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6 correction: NOT POS" },
  "21-9": { IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-6: scheduled report runtime + UI card" },
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
console.log(`Updated ${changed} ledger rows for Batch 8B-6.`);
