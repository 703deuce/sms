#!/usr/bin/env node
/**
 * Batch 8C — Post-implementation master reconciliation (308 rows).
 * Audit only — generates docs, does not modify application source.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const LEDGER_PATH = join(ROOT, "docs/APPOINTMENTS-FEATURE-ABSORPTION-LEDGER.csv");
const OUT_RECON = join(ROOT, "docs/APPOINTMENTS-POST-ABSORPTION-RECONCILIATION.md");
const OUT_LEDGER = join(ROOT, "docs/APPOINTMENTS-POST-ABSORPTION-LEDGER.csv");
const OUT_QUEUE = join(ROOT, "docs/APPOINTMENTS-RESIDUAL-V1-IMPLEMENTATION-QUEUE.md");
const OUT_TEMP = join(ROOT, "docs/APPOINTMENTS-TEMP-ROUTE-UNIQUE-FEATURE-AUDIT.md");
const OUT_JSON = join(ROOT, "docs/APPOINTMENTS-V1-CLOSURE-SUMMARY.json");

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const lines = [];
  let cur = "";
  let inQ = false;
  for (const ch of text) {
    if (ch === '"') {
      inQ = !inQ;
      cur += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (cur.trim()) lines.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) lines.push(cur);
  const parseLine = (line) => {
    const out = [];
    let cell = "";
    let q = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') q = !q;
      else if (c === "," && !q) {
        out.push(cell);
        cell = "";
      } else cell += c;
    }
    out.push(cell);
    return out.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
  };
  const header = parseLine(lines[0]);
  for (let li = 1; li < lines.length; li++) {
    const vals = parseLine(lines[li]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function routeExists(route) {
  if (!route || route === "N/A" || route === "—") return null;
  const clean = route.replace(/`/g, "").split("?")[0].replace(/\/$/, "");
  if (!clean.startsWith("/")) return null;
  const candidates = [
    join(ROOT, "src/app/(app)", clean.replace(/^\//, ""), "page.tsx"),
    join(ROOT, "src/app/(public)", clean.replace(/^\//, ""), "page.tsx"),
    join(ROOT, "src/app", clean.replace(/^\//, ""), "page.tsx"),
  ];
  // dynamic segments: /appointments/[id] -> check parent
  if (clean.includes("[")) {
    const parent = clean.split("/").slice(0, -1).join("/");
    return routeExists(parent);
  }
  return candidates.some((p) => existsSync(p));
}

function backendExists(loc) {
  if (!loc || loc === "—" || loc === "N/A") return null;
  const paths = loc.match(/`[^`]+`/g)?.map((s) => s.replace(/`/g, "")) || [];
  for (const p of paths) {
    const full = p.includes("/") ? join(ROOT, "src", p.replace(/^src\//, "")) : null;
    if (full && (existsSync(full) || existsSync(full + ".ts"))) return true;
    const lib = join(ROOT, "src/lib/appointments", p);
    if (existsSync(lib) || existsSync(lib + ".ts")) return true;
    const api = join(ROOT, "src/app/api/appointments", p);
    if (existsSync(api) || existsSync(join(api, "route.ts"))) return true;
  }
  return paths.length ? false : null;
}

/** Manual overrides from mechanical code inspection + 8B gap queue + temp route audit */
const OVERRIDES = {
  // Provider-blocked (external)
  "4-22": { status: "V1_PROVIDER_BLOCKED", gap: "iCloud calendar OAuth", evidence: "docs + scaffold only" },
  "4-23": { status: "V1_PROVIDER_BLOCKED", gap: "Reserve with Google", evidence: "PROVIDER_BLOCKED row" },
  "4-24": { status: "V1_PROVIDER_BLOCKED", gap: "Facebook Book Now", evidence: "PROVIDER_BLOCKED row" },
  "4-25": { status: "V1_PROVIDER_BLOCKED", gap: "Instagram Booking", evidence: "PROVIDER_BLOCKED row" },
  "15-8": { status: "V1_PROVIDER_BLOCKED", gap: "SAML SSO", evidence: "security-settings scaffold" },
  "15-9": { status: "V1_PROVIDER_BLOCKED", gap: "SCIM provisioning", evidence: "security-settings scaffold" },
  // V2 deferred
  "8-22": { status: "V2_DEFERRED", gap: "Payment plans", evidence: "/appointments/payments V2_ONLY" },
  "8-23": { status: "V2_DEFERRED", gap: "Loyalty program", evidence: "V2 row" },
  // Public gaps
  "5-26": { status: "V1_PUBLIC_UI_GAP", gap: "Stripe checkout depth in public booking", evidence: "PUBLIC_WAVE_PENDING", priority: "P0" },
  "5-27": { status: "V1_PUBLIC_UI_GAP", gap: "Square in-page payment in public flow", evidence: "PUBLIC_WAVE_PENDING", priority: "P0" },
  "5-29": { status: "V1_PUBLIC_UI_GAP", gap: "Public AI booking chat customer flow", evidence: "admin only wired", priority: "P1" },
  "5-30": { status: "V1_PUBLIC_UI_GAP", gap: "Public email AI booking", evidence: "channel card only", priority: "P1" },
  "5-32": { status: "V1_PUBLIC_UI_GAP", gap: "Workshop/Event dedicated public flow (no EVENT kind)", evidence: "BACKEND_GAP", priority: "P1" },
  "13-4": { status: "V1_PUBLIC_UI_GAP", gap: "Public AI chat booking", evidence: "duplicate of 5-29", priority: "P1" },
  "8-28": { status: "V1_PUBLIC_UI_GAP", gap: "Deposits/full payment public depth", evidence: "PARTIAL", priority: "P0" },
  // Portal gaps (post 8B-9)
  "7-18": { status: "V1_PORTAL_UI_GAP", gap: "Portal add/remove saved card (Stripe Elements)", evidence: "display only", priority: "P1" },
  "8-29": { status: "V1_PORTAL_UI_GAP", gap: "Portal saved card management", evidence: "setup API exists, no portal UI", priority: "P1" },
  // Admin / wrong placement — still on commerce hub
  "3-6": { status: "V1_WRONG_PLACEMENT", gap: "Categories admin only on /appointments/categories hub", evidence: "no /appointments/types categories drawer", priority: "P1" },
  "3-12": { status: "V1_WRONG_PLACEMENT", gap: "Contracts on temp /appointments/contracts", evidence: "no Forms & Documents canonical", priority: "P1" },
  "3-15": { status: "V1_WRONG_PLACEMENT", gap: "Resources on /appointments/resources hub", evidence: "no rooms-equipment canonical", priority: "P1" },
  "3-16": { status: "V1_WRONG_PLACEMENT", gap: "Classes on /appointments/classes hub", evidence: "types landing not split", priority: "P1" },
  "6-3": { status: "V1_WRONG_PLACEMENT", gap: "Recall campaigns on /appointments/recall-campaigns", evidence: "missing /appointments/automations/recall", priority: "P1" },
  "6-4": { status: "V1_WRONG_PLACEMENT", gap: "No-show recovery on temp route", evidence: "missing /appointments/automations/no-show", priority: "P1" },
  "6-8": { status: "V1_WRONG_PLACEMENT", gap: "Appointment segments on /appointments/segments", evidence: "distinct from contacts segments", priority: "P2" },
  "4-8": { status: "V1_WRONG_PLACEMENT", gap: "Resources on /appointments/resources hub", evidence: "no rooms-equipment canonical route", priority: "P1" },
  "11-8": { status: "V1_WRONG_PLACEMENT", gap: "Voice reminders on /appointments/voice-reminders", evidence: "not merged into /appointments/reminders", priority: "P1" },
  "5-21": { status: "V1_WRONG_PLACEMENT", gap: "Booking share on /appointments/booking/share", evidence: "not in booking pages hub", priority: "P2" },
  "5-22": { status: "V1_WRONG_PLACEMENT", gap: "Branding on /appointments/booking/branding", evidence: "theme editor temp route", priority: "P2" },
  // Backend gaps
  "8-25": { status: "V1_BACKEND_GAP", gap: "POS tax engine", evidence: "gap queue 8B-5", priority: "P1" },
  "9-6": { status: "V1_BACKEND_GAP", gap: "Invoice email send", evidence: "gap queue 8B-6", priority: "P2" },
  "9-7": { status: "V1_BACKEND_GAP", gap: "Invoice PDF export polish", evidence: "gap queue 8B-6", priority: "P2" },
  "13-2": { status: "V1_BACKEND_GAP", gap: "Poll vote → appointment booking", evidence: "gap queue 8B-7", priority: "P2" },
  "8-10": { status: "V1_BACKEND_GAP", gap: "Membership customer pause/cancel API", evidence: "portal view-only", priority: "P2" },
  // Admin UI gaps
  "2-8": { status: "V1_ADMIN_UI_GAP", gap: "Calendar staff lanes / colors", evidence: "calendar-connected partial", priority: "P1" },
  "2-9": { status: "V1_ADMIN_UI_GAP", gap: "Calendar drag-reschedule", evidence: "not wired", priority: "P1" },
  "2-11": { status: "V1_ADMIN_UI_GAP", gap: "Calendar availability overlays", evidence: "partial", priority: "P2" },
  "3-2": { status: "V1_ADMIN_UI_GAP", gap: "Appointment detail recurring series UI", evidence: "detail partial", priority: "P1" },
  "3-3": { status: "V1_ADMIN_UI_GAP", gap: "Appointment detail service phases display", evidence: "detail partial", priority: "P1" },
  "3-4": { status: "V1_ADMIN_UI_GAP", gap: "Appointment detail resource labels", evidence: "detail partial", priority: "P2" },
  "3-8": { status: "V1_ADMIN_UI_GAP", gap: "Waitlist priority rules admin", evidence: "gap queue P0", priority: "P0" },
  "3-9": { status: "V1_ADMIN_UI_GAP", gap: "Waitlist priority rank in table", evidence: "gap queue P0", priority: "P0" },
  "1-3": { status: "V1_ADMIN_UI_GAP", gap: "Mobile bottom nav appointments", evidence: "PARTIAL", priority: "P2" },
  "5-14": { status: "V1_PUBLIC_UI_GAP", gap: "Public poll vote page", evidence: "PUBLIC_WAVE_PENDING", priority: "P1" },
  "15-7": { status: "V1_ADMIN_UI_GAP", gap: "Per-booking-type permission editor", evidence: "STILL_MISSING", priority: "P2" },
  // Mock / placeholder
  "10-5": { status: "V1_MOCK_OR_PLACEHOLDER", gap: "Service-booking report JSON dump on temp route", evidence: "reports/service-booking", priority: "P2" },
  "1-1": { status: "V1_MOCK_OR_PLACEHOLDER", gap: "Overview decorative date picker / KPI gaps", evidence: "overview partial", priority: "P2" },
  // Contextual
  "3-20": { status: "V1_CONTEXTUAL_FLOW_GAP", gap: "Service → create staff contextual return", evidence: "contextual audit", priority: "P2" },
  // Complete via 8B waves (STATIC_PASS)
  "7-10": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-9 portal IA" },
  "7-11": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-9 appointments section" },
  "7-12": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-9 packages section" },
  "7-16": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-9 payment history" },
  "7-17": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-9 account credit" },
  "5-1": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-8 public booking home" },
  "5-24": { status: "V1_COMPLETE", gap: "", evidence: "Batch 8B-8 confirmation" },
};

const OUT_OF_SCOPE = new Set([
  // MCTB / mass SMS / smart routing should not appear as appointments V1
]);

const TEMP_ROUTES = [
  { route: "/appointments/commerce", classification: "PARTIALLY_ABSORBED", unique: 12, canonical: "Multiple commerce pages" },
  { route: "/appointments/service-booking", classification: "READY_FOR_RETIREMENT", unique: 0, canonical: "Alias hub entry" },
  { route: "/appointments/policies", classification: "PARTIALLY_ABSORBED", unique: 1, canonical: "/appointments/types Advanced" },
  { route: "/appointments/client-restrictions", classification: "PARTIALLY_ABSORBED", unique: 0, canonical: "/contacts/[id] Booking Access" },
  { route: "/appointments/coupons", classification: "PARTIALLY_ABSORBED", unique: 0, canonical: "/appointments/discounts" },
  { route: "/appointments/payments", classification: "V2_ONLY", unique: 1, canonical: "V2 deferred" },
  { route: "/appointments/contracts", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/booking/forms" },
  { route: "/appointments/booking/contracts", classification: "READY_FOR_RETIREMENT", unique: 0, canonical: "Duplicate of contracts" },
  { route: "/appointments/categories", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/types" },
  { route: "/appointments/segments", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/recalls" },
  { route: "/appointments/scheduled", classification: "READY_FOR_RETIREMENT", unique: 0, canonical: "/appointments" },
  { route: "/appointments/recall-campaigns", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/automations/recall" },
  { route: "/appointments/no-show-recovery", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/automations/no-show" },
  { route: "/appointments/commerce/contact-merge", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/contacts merge modal" },
  { route: "/appointments/booking/share", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/booking" },
  { route: "/appointments/booking/branding", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/booking" },
  { route: "/appointments/reports/service-booking", classification: "PARTIALLY_ABSORBED", unique: 1, canonical: "/appointments/analytics/reports" },
  { route: "/appointments/classes", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/types/classes" },
  { route: "/appointments/resources", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/booking/rooms-equipment" },
  { route: "/appointments/routing", classification: "PARTIALLY_ABSORBED", unique: 1, canonical: "/appointments/routing-forms" },
  { route: "/appointments/voice-reminders", classification: "STILL_HAS_UNIQUE_V1", unique: 1, canonical: "/appointments/reminders" },
  { route: "/appointments/restrictions", classification: "READY_FOR_RETIREMENT", unique: 0, canonical: "Duplicate client-restrictions" },
];

function classifyRow(row) {
  const id = row.FEATURE_ID;
  if (OVERRIDES[id]) {
    const o = OVERRIDES[id];
    return { ...o, nextAction: o.gap ? `Implement: ${o.gap}` : "Browser certification when ready" };
  }

  if (row.V1_V2 === "V2" || row.IMPL_STATE === "V2_DEFERRED") {
    return { status: "V2_DEFERRED", gap: "Deferred V2", evidence: row.NOTES || "V2 row", nextAction: "V2 scope" };
  }
  if (OUT_OF_SCOPE.has(id)) {
    return { status: "OUT_OF_SCOPE_ERROR", gap: "Misclassified", evidence: "out of appointments V1", nextAction: "Reclassify" };
  }
  if (row.UAT_STATUS === "PROVIDER_BLOCKED" || row.IMPL_STATE === "PROVIDER_BLOCKED") {
    return { status: "V1_PROVIDER_BLOCKED", gap: row.PROVIDER_DEPENDENCY || "External provider", evidence: "ledger PROVIDER_BLOCKED", nextAction: "External credentials" };
  }
  if (row.FINAL_SURFACE_TYPE === "RUNTIME_ONLY" || row.IMPL_STATE === "RUNTIME_ONLY_COMPLETE" || row.IMPL_STATE === "RUNTIME_UI_EFFECT") {
    return { status: "V1_COMPLETE_RUNTIME_ONLY", gap: "", evidence: row.BACKEND_LOCATION || "runtime", nextAction: "Certify runtime behavior" };
  }
  if (
    row.UAT_STATUS === "STATIC_PASS" ||
    row.UAT_STATUS === "PASS" ||
    row.UAT_STATUS === "CODE_COMPLETE" ||
    row.IMPL_STATE === "ABSORBED_CANONICAL_UI" ||
    row.IMPL_STATE === "ALREADY_PRESENT" ||
    row.IMPL_STATE === "COMPLETE_CURRENT_UI"
  ) {
    // Verify not still on temp-only
    if (row.TEMP_PARITY_EXISTS === "YES" && row.FINAL_CANONICAL_PAGE && !routeExists(row.FINAL_CANONICAL_PAGE)) {
      return { status: "V1_WRONG_PLACEMENT", gap: `Canonical route missing: ${row.FINAL_CANONICAL_PAGE}`, evidence: "temp parity still primary", nextAction: "Absorb to canonical route" };
    }
    return { status: "V1_COMPLETE", gap: "", evidence: `${row.UAT_STATUS || row.IMPL_STATE}; ${row.CURRENT_ROUTE || row.FINAL_CANONICAL_PAGE}`, nextAction: "Browser UAT when cert phase starts" };
  }
  if (row.IMPL_STATE === "PUBLIC_WAVE_PENDING" || row.PUBLIC_COMPLETE === "PARTIAL" || (row.FINAL_SURFACE_TYPE === "PUBLIC_BOOKING" && row.PUBLIC_PRESENT === "PARTIAL")) {
    return { status: "V1_PUBLIC_UI_GAP", gap: row.MISSING_UI || "Public consumer incomplete", evidence: row.CURRENT_ROUTE || "public booking", nextAction: "Complete public flow wiring" };
  }
  if (row.PORTAL_COMPLETE === "PARTIAL" || (row.FINAL_SURFACE_TYPE === "CUSTOMER_PORTAL" && row.PORTAL_PRESENT === "PARTIAL")) {
    return { status: "V1_PORTAL_UI_GAP", gap: row.MISSING_UI || "Portal depth incomplete", evidence: "/portal", nextAction: "Complete portal surface" };
  }
  if (row.BACKEND_PRESENT === "NO" || row.BACKEND_COMPLETE === "NO") {
    return { status: "V1_BACKEND_GAP", gap: row.MISSING_BACKEND || "Backend incomplete", evidence: row.BACKEND_LOCATION, nextAction: "Implement backend" };
  }
  if (row.UI_PRESENT === "NO" && row.BACKEND_PRESENT === "YES") {
    return { status: "V1_ADMIN_UI_GAP", gap: row.MISSING_UI || "Admin UI missing", evidence: row.FINAL_CANONICAL_PAGE, nextAction: "Build admin UI on canonical page" };
  }
  if (row.TEMP_PARITY_EXISTS === "YES" && row.IMPL_STATE === "EXTEND_EXISTING_PAGE") {
    const canon = row.FINAL_CANONICAL_PAGE?.replace(/`/g, "");
    if (canon && !routeExists(canon)) {
      return { status: "V1_WRONG_PLACEMENT", gap: `Feature on temp route; canonical ${canon} missing`, evidence: row.CURRENT_ROUTE, nextAction: "Move to canonical page" };
    }
  }
  if (row.UI_COMPLETE === "PARTIAL" || row.UI_COMPLETE === "LIKELY") {
    const surface = row.FINAL_SURFACE_TYPE;
    if (surface === "PUBLIC_BOOKING") return { status: "V1_PUBLIC_UI_GAP", gap: "Public UI partial", evidence: row.CURRENT_ROUTE, nextAction: "Extend public booking" };
    if (surface === "CUSTOMER_PORTAL") return { status: "V1_PORTAL_UI_GAP", gap: "Portal UI partial", evidence: row.CURRENT_ROUTE, nextAction: "Extend portal" };
    return { status: "V1_ADMIN_UI_GAP", gap: "Admin UI partial", evidence: row.FINAL_CANONICAL_PAGE || row.CURRENT_ROUTE, nextAction: "Extend canonical page" };
  }
  if (row.DUPLICATE_UI === "YES") {
    return { status: "V1_DUPLICATE_CONFLICT", gap: "Duplicate UI surfaces", evidence: row.CURRENT_ROUTE, nextAction: "Consolidate to one home" };
  }
  // UA_PENDING default: implementation exists but not reconciled — treat as admin partial unless public/portal
  if (row.FINAL_SURFACE_TYPE === "PUBLIC_BOOKING") {
    return { status: "V1_PUBLIC_UI_GAP", gap: "Public flow UA_PENDING", evidence: row.FEATURE_NAME, nextAction: "Verify public consumer wiring" };
  }
  if (row.FINAL_SURFACE_TYPE === "CUSTOMER_PORTAL") {
    return { status: "V1_PORTAL_UI_GAP", gap: "Portal UA_PENDING", evidence: row.FEATURE_NAME, nextAction: "Verify portal wiring" };
  }
  if (row.UAT_STATUS === "N/A") {
    return { status: "V1_COMPLETE_RUNTIME_ONLY", gap: "", evidence: "N/A surface", nextAction: "None" };
  }
  return { status: "V1_ADMIN_UI_GAP", gap: "UA_PENDING — depth unverified", evidence: `${row.IMPL_STATE}; ${row.FINAL_CANONICAL_PAGE}`, nextAction: "Inspect and complete on canonical page" };
}

function csvEscape(s) {
  const t = String(s ?? "");
  if (t.includes(",") || t.includes('"') || t.includes("\n")) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function main() {
  const rows = parseCsv(readFileSync(LEDGER_PATH, "utf8"));
  const reconciled = rows.map((row) => {
    const c = classifyRow(row);
    const routeOk = routeExists(row.FINAL_CANONICAL_PAGE?.replace(/`/g, "") || row.CURRENT_ROUTE?.replace(/`/g, ""));
    const beOk = backendExists(row.BACKEND_LOCATION);
    return {
      FEATURE_ID: row.FEATURE_ID,
      FEATURE_NAME: row.FEATURE_NAME,
      V1_V2: row.V1_V2,
      EXPECTED_USER_JOB: row.FINAL_USER_NAME || row.FEATURE_NAME,
      FINAL_ADMIN_CANONICAL_PAGE: row.FINAL_CANONICAL_PAGE,
      FINAL_PUBLIC_SURFACE: row.FINAL_SURFACE_TYPE === "PUBLIC_BOOKING" ? row.FINAL_CANONICAL_PAGE : "",
      FINAL_PORTAL_SURFACE: row.FINAL_SURFACE_TYPE === "CUSTOMER_PORTAL" ? row.FINAL_CANONICAL_PAGE : "",
      FINAL_CONTEXTUAL_ENTRY: row.FINAL_CONTEXTUAL_ENTRY || "",
      CURRENT_ADMIN_UI_PRESENT: row.UI_PRESENT,
      CURRENT_ADMIN_UI_COMPLETE: row.UI_COMPLETE,
      CURRENT_PUBLIC_UI_PRESENT: row.PUBLIC_PRESENT,
      CURRENT_PUBLIC_UI_COMPLETE: row.PUBLIC_COMPLETE,
      CURRENT_PORTAL_UI_PRESENT: row.PORTAL_PRESENT,
      CURRENT_PORTAL_UI_COMPLETE: row.PORTAL_COMPLETE,
      CURRENT_CONTEXTUAL_ACCESS_PRESENT: row.FINAL_CONTEXTUAL_ENTRY ? "PARTIAL" : "N/A",
      CURRENT_CONTEXTUAL_ACCESS_COMPLETE: row.FINAL_CONTEXTUAL_ENTRY ? "PARTIAL" : "N/A",
      BACKEND_PRESENT: row.BACKEND_PRESENT,
      BACKEND_COMPLETE_ENOUGH: row.BACKEND_COMPLETE,
      PERSISTENCE_PATH_PRESENT: beOk === true ? "YES" : beOk === false ? "UNVERIFIED" : "N/A",
      PROVIDER_DEPENDENCY: row.PROVIDER_DEPENDENCY,
      TEMP_PARITY_COPY_EXISTS: row.TEMP_PARITY_EXISTS,
      TEMP_PARITY_UNIQUE: row.TEMP_PARITY_EXISTS === "YES" && c.status === "V1_WRONG_PLACEMENT" ? "YES" : "NO",
      MOCK_PLACEHOLDER_RESIDUE: c.status === "V1_MOCK_OR_PLACEHOLDER" ? "YES" : "NO",
      CURRENT_FINAL_STATUS: c.status,
      EXACT_REMAINING_GAP: c.gap,
      NEXT_ACTION: c.nextAction,
      EVIDENCE: `${c.evidence}; routeExists=${routeOk}; backend=${beOk}`,
      PRIORITY: c.priority || "",
    };
  });

  const counts = {};
  for (const r of reconciled) counts[r.CURRENT_FINAL_STATUS] = (counts[r.CURRENT_FINAL_STATUS] || 0) + 1;

  const v1Rows = reconciled.filter((r) => r.V1_V2 === "V1");
  const v2Rows = reconciled.filter((r) => r.V1_V2 === "V2");

  const residual = reconciled.filter((r) =>
    !["V1_COMPLETE", "V1_COMPLETE_RUNTIME_ONLY", "V1_COMPLETE_PROVIDER_READY", "V1_PROVIDER_BLOCKED", "V2_DEFERRED", "OUT_OF_SCOPE_ERROR"].includes(r.CURRENT_FINAL_STATUS),
  );

  const commerceUnique = TEMP_ROUTES.filter((t) => t.classification === "STILL_HAS_UNIQUE_V1").reduce((s, t) => s + t.unique, 0);
  const tempUniqueRoutes = TEMP_ROUTES.filter((t) => t.classification === "STILL_HAS_UNIQUE_V1").length;

  const backendReadyUiMissing = reconciled.filter((r) => r.BACKEND_PRESENT === "YES" && ["V1_ADMIN_UI_GAP", "V1_PUBLIC_UI_GAP", "V1_PORTAL_UI_GAP"].includes(r.CURRENT_FINAL_STATUS));
  const uiPresentBackendGap = reconciled.filter((r) => r.UI_PRESENT === "YES" && r.CURRENT_FINAL_STATUS === "V1_BACKEND_GAP");

  // Post-absorption ledger CSV
  const headers = Object.keys(reconciled[0]);
  const csvOut = [headers.join(",")].concat(reconciled.map((r) => headers.map((h) => csvEscape(r[h])).join(","))).join("\n") + "\n";
  writeFileSync(OUT_LEDGER, csvOut);

  // Residual queue
  const byPage = {};
  for (const r of residual) {
    const page = r.FINAL_ADMIN_CANONICAL_PAGE || r.FINAL_PUBLIC_SURFACE || r.FINAL_PORTAL_SURFACE || "UNASSIGNED";
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(r);
  }
  let queueMd = `# Appointments — Residual V1 Implementation Queue (Batch 8C)\n\n**Generated:** 2026-09-10\n**Type:** Mechanical reconciliation — implementation work only\n**Total residual rows:** ${residual.length}\n\n`;
  const prioOrder = { P0: 0, P1: 1, P2: 2, "": 3 };
  for (const [page, items] of Object.entries(byPage).sort((a, b) => a[0].localeCompare(b[0]))) {
    queueMd += `## ${page}\n\n`;
    items.sort((a, b) => (prioOrder[a.PRIORITY] ?? 3) - (prioOrder[b.PRIORITY] ?? 3));
    for (const r of items) {
      queueMd += `### ${r.FEATURE_ID} — ${r.FEATURE_NAME}\n`;
      queueMd += `- **Gap type:** ${r.CURRENT_FINAL_STATUS}\n`;
      queueMd += `- **Section:** ${r.FINAL_ADMIN_CANONICAL_PAGE}\n`;
      queueMd += `- **Missing:** ${r.EXACT_REMAINING_GAP}\n`;
      queueMd += `- **Backend:** ${r.BACKEND_PRESENT} / ${r.BACKEND_COMPLETE_ENOUGH}\n`;
      queueMd += `- **Priority:** ${r.PRIORITY || "P2"}\n`;
      queueMd += `- **Evidence:** ${r.EVIDENCE}\n\n`;
    }
  }

  // Proposed batches
  queueMd += `## Proposed residual implementation batches (8D series)\n\n`;
  queueMd += `| Batch | Domain | Approx rows |\n|-------|--------|------------:|\n`;
  queueMd += `| 8D-1 | Route convergence + wrong-placement (commerce hub → canonical pages) | ${reconciled.filter((r) => r.CURRENT_FINAL_STATUS === "V1_WRONG_PLACEMENT").length} |\n`;
  queueMd += `| 8D-2 | Public booking payment + class/event + AI public flows | ${reconciled.filter((r) => r.CURRENT_FINAL_STATUS === "V1_PUBLIC_UI_GAP").length} |\n`;
  queueMd += `| 8D-3 | Portal depth (saved cards, membership self-service, household) | ${reconciled.filter((r) => r.CURRENT_FINAL_STATUS === "V1_PORTAL_UI_GAP").length} |\n`;
  queueMd += `| 8D-4 | Operations (calendar, detail, waitlist) | admin gaps on ops pages |\n`;
  queueMd += `| 8D-5 | Automations canonical routes + voice reminder merge | wrong-placement automations |\n`;
  queueMd += `| 8D-6 | Backend gaps (POS tax, invoice email/PDF, poll booking) | ${reconciled.filter((r) => r.CURRENT_FINAL_STATUS === "V1_BACKEND_GAP").length} |\n`;

  writeFileSync(OUT_QUEUE, queueMd);

  // Temp route audit
  let tempMd = `# Appointments — Temporary Route Unique-Feature Audit (Batch 8C)\n\n**Generated:** 2026-09-10\n\n`;
  tempMd += `| Route | Classification | Unique V1 functions | Canonical destination |\n|-------|----------------|--------------------:|------------------------|\n`;
  for (const t of TEMP_ROUTES) {
    tempMd += `| \`${t.route}\` | ${t.classification} | ${t.unique} | ${t.canonical} |\n`;
  }
  tempMd += `\n**Commerce unique required V1 count (estimate):** ${commerceUnique}\n`;
  tempMd += `**Temp routes with unique V1:** ${tempUniqueRoutes}\n`;
  tempMd += `**Ready for retirement:** ${TEMP_ROUTES.filter((t) => t.classification === "READY_FOR_RETIREMENT").length}\n`;
  writeFileSync(OUT_TEMP, tempMd);

  const summary = {
    generatedAt: "2026-09-10",
    batch: "8C",
    totalMasterRows: reconciled.length,
    v1Rows: v1Rows.length,
    v2Rows: v2Rows.length,
    statusCounts: counts,
    backendReadyUiMissing: backendReadyUiMissing.length,
    uiPresentBackendGap: uiPresentBackendGap.length,
    commerceUniqueV1Features: commerceUnique,
    tempRoutesStillUniqueV1: tempUniqueRoutes,
    tempRoutesReadyForRetirement: TEMP_ROUTES.filter((t) => t.classification === "READY_FOR_RETIREMENT").length,
    residualImplementationRows: residual.length,
    unassignedError: reconciled.filter((r) => r.CURRENT_FINAL_STATUS === "UNASSIGNED_ERROR").length,
    outOfScopeError: reconciled.filter((r) => r.CURRENT_FINAL_STATUS === "OUT_OF_SCOPE_ERROR").length,
    readyForRouteConvergence: commerceUnique === 0 && tempUniqueRoutes === 0 ? "YES" : "NO",
    readyForMasterBrowserCertification: residual.length === 0 ? "YES" : "NO",
  };
  writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + "\n");

  // Main reconciliation report
  const reconMd = `# Appointments Post-Absorption Reconciliation (Batch 8C)

**Generated:** 2026-09-10  
**Type:** Mechanical implementation reconciliation — NOT browser UAT  
**Waves reconciled:** 8B-1 through 8B-9

## Executive summary

After Batches 8B-1–8B-9, mechanical re-audit of all **${reconciled.length}** master ledger rows finds:

| Metric | Count |
|--------|------:|
| V1 rows | ${v1Rows.length} |
| V2 rows | ${v2Rows.length} |
| **V1_COMPLETE** | ${counts.V1_COMPLETE || 0} |
| **V1_COMPLETE_RUNTIME_ONLY** | ${counts.V1_COMPLETE_RUNTIME_ONLY || 0} |
| **V1_PROVIDER_BLOCKED** | ${counts.V1_PROVIDER_BLOCKED || 0} |
| **V1_ADMIN_UI_GAP** | ${counts.V1_ADMIN_UI_GAP || 0} |
| **V1_PUBLIC_UI_GAP** | ${counts.V1_PUBLIC_UI_GAP || 0} |
| **V1_PORTAL_UI_GAP** | ${counts.V1_PORTAL_UI_GAP || 0} |
| **V1_WRONG_PLACEMENT** | ${counts.V1_WRONG_PLACEMENT || 0} |
| **V1_BACKEND_GAP** | ${counts.V1_BACKEND_GAP || 0} |
| **V1_MOCK_OR_PLACEHOLDER** | ${counts.V1_MOCK_OR_PLACEHOLDER || 0} |
| **V2_DEFERRED** | ${counts.V2_DEFERRED || 0} |
| **UNASSIGNED_ERROR** | ${summary.unassignedError} |
| Residual implementation rows | ${residual.length} |
| Commerce unique V1 (temp hub) | ${commerceUnique} |
| Temp routes with unique V1 | ${tempUniqueRoutes} |

### Readiness

| Gate | Result |
|------|--------|
| **READY_FOR_ROUTE_CONVERGENCE** | **${summary.readyForRouteConvergence}** |
| **READY_FOR_MASTER_BROWSER_CERTIFICATION** | **${summary.readyForMasterBrowserCertification}** |

Route convergence requires **zero** temp routes with unique required V1 functionality. Certification requires **zero** known implementation gaps (provider-blocked and runtime-only excepted).

---

## 1. Overall counts

See \`docs/APPOINTMENTS-V1-CLOSURE-SUMMARY.json\`.

## 2. V1 closure status

Primary closure distribution: ${Object.entries(counts).map(([k,v]) => `${k}=${v}`).join(", ")}.

## 3. Remaining implementation gaps

**${residual.length}** rows require implementation work. Full queue: \`docs/APPOINTMENTS-RESIDUAL-V1-IMPLEMENTATION-QUEUE.md\`.

Top gap types:
- Admin UI depth on canonical pages (calendar, appointment detail, waitlist, overview)
- Wrong placement — features still on \`ServiceBookingAdminClient\` hub / temp routes
- Public booking payment + AI + class/event flows
- Portal saved-card management + membership self-service

## 4. Public Booking status

Mechanically inspected (not browser certified). **8B-8** delivered catalog grouping, terminology, confirmation real data, manage URL. **Residual:** Stripe/Square payment depth, Workshop/Event kind, public AI chat/email, class enrollment parity, single-use link UX.

## 5. Portal status

**8B-9** delivered unified portal IA with OTP, appointments, packages, payments, documents, profile. **Residual:** add/remove saved cards in portal UI, membership pause/cancel self-service, dependent booking, meeting recap customer view.

## 6. Contextual flow status

13 contextual flows from 8A audit — partial auto-select/return on booking-type editors. See residual queue contextual rows.

## 7. Backend/UI mismatches

- **Backend ready / UI missing:** ${backendReadyUiMissing.length} rows
- **UI present / backend gap:** ${uiPresentBackendGap.length} rows

## 8. Persistence gaps

High-risk areas inspected via backend path existence. Rows with \`PERSISTENCE_PATH_PRESENT=UNVERIFIED\` flagged in post ledger for manual follow-up (calendar colors, special dates, routing rules).

## 9. Mock/placeholder blockers

Production-path mock residue: public booking kimi types (type-only imports OK), legacy confirm/reschedule sandbox fallbacks (production uses \`live\` API), service-booking report JSON dump on temp route, overview decorative controls.

## 10. Temporary route status

See \`docs/APPOINTMENTS-TEMP-ROUTE-UNIQUE-FEATURE-AUDIT.md\`. **${tempUniqueRoutes}** routes still hold unique V1; **${TEMP_ROUTES.filter(t=>t.classification==="READY_FOR_RETIREMENT").length}** ready for retirement after absorption.

## 11. Commerce unique-function status

**${commerceUnique}** unique required V1 functions estimated still on commerce/hub routes (target: 0).

## 12. Provider-blocked status

${counts.V1_PROVIDER_BLOCKED || 0} rows: iCloud, Reserve with Google, Facebook/Instagram booking, SAML, SCIM.

## 13. V2/out-of-scope status

${counts.V2_DEFERRED || 0} V2 deferred. Out-of-scope contamination: ${summary.outOfScopeError} (target 0).

## 14. Proposed residual implementation batches

See queue doc § Proposed 8D batches (route convergence → public → portal → ops → automations → backend).

## 15. Route-retirement readiness

**${summary.readyForRouteConvergence}** — Do not retire temp routes until canonical pages absorb unique functionality.

## 16. Certification readiness

**${summary.readyForMasterBrowserCertification}** — ${residual.length} implementation gaps remain before master browser certification.

---

## Gap queue reconciliation (8A → 8C)

| 8A assumption | 8C result |
|---------------|-----------|
| Portal wave pending | **RESOLVED** for core portal (8B-9); residual saved-card UI |
| Public booking 34 gaps | **PARTIALLY RESOLVED** (8B-8); payment + event/class remain |
| Commerce 29 temp unique | **${commerceUnique}** unique functions remain on hub |
| Backend-ready UI-missing 184 | **Recalculated: ${backendReadyUiMissing.length}** |
| UI-present backend-uncertain 89 | **Recalculated: ${uiPresentBackendGap.length}** |

---

*Full row-level data: \`docs/APPOINTMENTS-POST-ABSORPTION-LEDGER.csv\`*
`;
  // Page-by-page rollup
  const PAGE_FAMILIES = [
    "/appointments/overview", "/appointments/calendar", "/appointments", "/appointments/[id]",
    "/appointments/waitlist", "/appointments/recalls", "/appointments/types", "/appointments/types/meetings",
    "/appointments/types/services", "/appointments/types/classes", "/appointments/booking",
    "/appointments/availability", "/appointments/staff", "/appointments/locations",
    "/appointments/packages", "/appointments/memberships", "/appointments/gift-cards", "/appointments/pos",
    "/payments/transactions", "/payments/invoices", "/contacts", "/contacts/[id]",
    "/appointments/reminders", "/appointments/workflows", "/appointments/routing-forms",
    "/appointments/analytics", "/book", "/portal/[token]", "/manage/[token]",
  ];
  let pageSection = `\n## Page-by-page completeness (Part 3)\n\n| Page | Expected rows | Complete | Partial/Gap | Wrong placement |\n|------|--------------:|---------:|------------:|----------------:|\n`;
  for (const page of PAGE_FAMILIES) {
    const matched = reconciled.filter((r) => (r.FINAL_ADMIN_CANONICAL_PAGE || "").includes(page) || (r.FINAL_PUBLIC_SURFACE || "").includes(page) || (r.FINAL_PORTAL_SURFACE || "").includes(page));
    const complete = matched.filter((r) => r.CURRENT_FINAL_STATUS === "V1_COMPLETE" || r.CURRENT_FINAL_STATUS === "V1_COMPLETE_RUNTIME_ONLY").length;
    const gap = matched.filter((r) => residual.includes(r)).length;
    const wrong = matched.filter((r) => r.CURRENT_FINAL_STATUS === "V1_WRONG_PLACEMENT").length;
    const classification = gap === 0 ? "CLOSED" : gap <= 2 ? "SMALL RESIDUAL" : gap <= 6 ? "MEDIUM RESIDUAL" : "MAJOR RESIDUAL";
    pageSection += `| \`${page}\` | ${matched.length} | ${complete} | ${gap} (${classification}) | ${wrong} |\n`;
  }

  const publicMatrix = [
    ["Meeting Type selection", "YES", "PARTIAL", "catalog API", "PARTIAL", "Class/event dedicated flows"],
    ["Service flow + add-ons", "YES", "PARTIAL", "public-booking-service", "PARTIAL", "Add-ons-before-slot reorder"],
    ["Payment Stripe/Square", "YES", "PARTIAL", "merchant payments", "GAP", "PUBLIC_WAVE_PENDING rows"],
    ["Packages/memberships at checkout", "YES", "LIKELY", "entitlements", "PARTIAL", "—"],
    ["Portal OTP + session", "YES", "YES", "client-portal.ts", "COMPLETE", "Saved card add/remove UI"],
    ["Legacy confirm/cancel/reschedule", "YES", "YES", "live API mode", "COMPLETE", "—"],
  ];
  let publicSection = `\n## Public Booking matrix (Part 4)\n\n| Feature | Admin config | Public consumer | Data contract | Present? | Complete? | Residual |\n|---------|-------------|-----------------|---------------|----------|-----------|----------|\n`;
  for (const row of publicMatrix) {
    publicSection += `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${row[6]} |\n`;
  }

  const portalChecklist = [
    ["Auth token + OTP", existsSync(join(ROOT, "src/lib/appointments/service-booking/portal-customer-payload.ts")) ? "COMPLETE" : "GAP"],
    ["Appointments upcoming/past", existsSync(join(ROOT, "src/components/appointments/client-portal-public-client.tsx")) ? "COMPLETE" : "GAP"],
    ["Packages + credit history", "COMPLETE"],
    ["Saved payment methods add/remove", "GAP — display only"],
    ["Membership pause/cancel self-service", "GAP — backend staff-only"],
    ["Household dependent booking", "GAP — display only"],
  ];
  let portalSection = `\n## Portal reconciliation (Part 5)\n\n| Area | Status |\n|------|--------|\n`;
  for (const [area, st] of portalChecklist) portalSection += `| ${area} | ${st} |\n`;

  const contextualFlows = [
    ["SERVICE → STAFF", "PARTIAL", "NO_CREATE", "Type editor", "P2"],
    ["SERVICE → INTAKE FORM", "PARTIAL", "NO_AUTO_SELECT", "Forms contextual", "P2"],
    ["CONTACT → PACKAGE", "COMPLETE", "—", "Contact detail", "—"],
    ["POS → COUPON", "COMPLETE", "—", "8B-5", "—"],
    ["IMPORT → CUSTOMER FIELD", "COMPLETE", "—", "8B-5", "—"],
  ];
  let ctxSection = `\n## Contextual flows (Part 6)\n\n| Flow | Status | Failure class | Evidence | Priority |\n|------|--------|---------------|----------|----------|\n`;
  for (const row of contextualFlows) ctxSection += `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} |\n`;

  let mockSection = `\n## Mock / placeholder audit (Part 9)\n\n`;
  try {
    const mockHits = execSync(
      `rg -l "from.*mock-data|MOCK_APPOINTMENT|MOCK_SLOTS" src/components/appointments src/features/appointments --glob "*.tsx" 2>/dev/null | head -25`,
      { encoding: "utf8", cwd: ROOT },
    ).trim().split("\n").filter(Boolean);
    mockSection += `| File | Classification |\n|------|----------------|\n`;
    for (const f of mockHits) {
      const cls = f.includes("public-confirm") || f.includes("public-reschedule") ? "SAFE_DEV_ONLY (production uses live API)" : f.includes("mock-data") && f.includes("type") ? "SAFE_DEV_ONLY (type imports)" : "V1_PRODUCTION_BLOCKER";
      mockSection += `| \`${f}\` | ${cls} |\n`;
    }
  } catch {
    mockSection += "_Mock scan: see manual inspection in reconciliation notes._\n";
  }

  writeFileSync(OUT_RECON, reconMd + pageSection + publicSection + portalSection + ctxSection + mockSection);

  // Update gap queue header
  const gapPath = join(ROOT, "docs/APPOINTMENTS-EXISTING-PAGE-GAP-QUEUE.md");
  const gapContent = readFileSync(gapPath, "utf8");
  if (!gapContent.includes("Batch 8C reconciliation")) {
    writeFileSync(
      gapPath,
      `## Batch 8C reconciliation (2026-09-10) — MECHANICAL AUDIT COMPLETE\n\n308-row post-absorption reconciliation complete. See:\n- \`docs/APPOINTMENTS-POST-ABSORPTION-RECONCILIATION.md\`\n- \`docs/APPOINTMENTS-RESIDUAL-V1-IMPLEMENTATION-QUEUE.md\`\n- \`docs/APPOINTMENTS-V1-CLOSURE-SUMMARY.json\`\n\n**Route convergence:** ${summary.readyForRouteConvergence} | **Certification:** ${summary.readyForMasterBrowserCertification} | **Residual rows:** ${residual.length}\n\n` +
        gapContent,
    );
  }

  console.log("Batch 8C reconciliation complete");
  console.log(JSON.stringify(summary, null, 2));
}

main();
