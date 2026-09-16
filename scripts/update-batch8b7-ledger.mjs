#!/usr/bin/env node
/**
 * Batch 8B-7 ledger status updates — Meetings + Specialized Booking Tools.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = join(root, "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");

const updates = {
  "4-13": { FINAL_CANONICAL_PAGE: "/appointments/team-pages", FINAL_SECTION: "Team Booking", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: scheduling groups + pages" },
  "5-29": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "Public channels", IMPL_STATE: "PUBLIC_WAVE_PENDING", NOTES: "Batch 8B-7: admin wired; public chat pending" },
  "5-30": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "Email channel", IMPL_STATE: "PUBLIC_WAVE_PENDING", NOTES: "Batch 8B-7: channels card exposes email when configured" },
  "6-6": { FINAL_CANONICAL_PAGE: "/appointments/calendar", FINAL_SECTION: "Meeting indicators", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-7: prior batch; same instance as Upcoming" },
  "13-1": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "AI Booking", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: admin try-it + channels" },
  "13-3": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "Channels", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: InboundChannelsCard" },
  "13-4": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "Public chat", IMPL_STATE: "PUBLIC_WAVE_PENDING", NOTES: "Batch 8B-7" },
  "13-6": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "Runtime", IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: understand/execute not exposed as toggles" },
  "13-7": { FINAL_CANONICAL_PAGE: "/appointments/ai-booking", FINAL_SECTION: "Protection", IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7" },
  "14-1": { FINAL_CANONICAL_PAGE: "/video", FINAL_SECTION: "Meetings Upcoming", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: combined video+notetaker overview" },
  "14-2": { FINAL_CANONICAL_PAGE: "/video", FINAL_SECTION: "Join host", IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: host join from Upcoming" },
  "14-3": { FINAL_CANONICAL_PAGE: "/video/[token]", FINAL_SECTION: "Public join", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-7: preserved" },
  "14-4": { FINAL_CANONICAL_PAGE: "/meetings", FINAL_SECTION: "Meetings Recaps", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: source=all" },
  "14-5": { FINAL_CANONICAL_PAGE: "/meetings", FINAL_SECTION: "Share recap", IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: share modal preserved" },
  "14-6": { FINAL_CANONICAL_PAGE: "/settings/transovo-video", FINAL_SECTION: "Settings → Meetings", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7 placement correction" },
  "14-7": { FINAL_CANONICAL_PAGE: "/settings/ai-notetaker", FINAL_SECTION: "Settings → Meetings", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7 placement correction" },
  "14-8": { FINAL_CANONICAL_PAGE: "/video", FINAL_SECTION: "Provider status", IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: runtime via appointment detail; Teams PROVIDER_BLOCKED partial" },
  "14-9": { FINAL_CANONICAL_PAGE: "/appointments/calendar", FINAL_SECTION: "Indicators", IMPL_STATE: "ALREADY_PRESENT", NOTES: "Batch 8B-7" },
  "15-5": { FINAL_CANONICAL_PAGE: "/appointments/team-pages", FINAL_SECTION: "Team Booking", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7: slug fix + preview" },
  "15-6": { FINAL_CANONICAL_PAGE: "/team/[slug]/[pageSlug]", FINAL_SECTION: "Public team page", IMPL_STATE: "RUNTIME_UI_EFFECT", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7" },
  "15-7": { FINAL_CANONICAL_PAGE: "/appointments/polls", FINAL_SECTION: "Meeting Polls", IMPL_STATE: "ABSORBED_CANONICAL_UI", UAT_STATUS: "STATIC_PASS", NOTES: "Batch 8B-7 placement correction from /video" },
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
console.log(`Updated ${changed} ledger rows for Batch 8B-7.`);
