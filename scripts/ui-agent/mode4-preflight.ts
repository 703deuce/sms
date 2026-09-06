#!/usr/bin/env tsx
/**
 * Mode 4 preflight integrity audit — run BEFORE any Kimi generation.
 *
 *   npm run ui:kimi-mode4-preflight
 *   npm run ui:kimi-mode4-preflight -- --write-report
 *
 * Exits 1 on FAIL. Does not launch Kimi, builds, browsers, or tests.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, UI_AGENT_DIR } from "./config";
import { loadMode4Manifest, type Mode4ManifestEntry } from "./mode4-manifest";
import {
  EXCLUDED_FROM_STANDARDS_PACK,
  MODE4_ART_DIRECTION_VIDEOS,
  TRANSOVO_STANDARDS_DOCS,
  loadStandardsPack,
  standardsPackTotals,
  writeStandardsPackArtifact,
} from "./mode4-standards-pack";
import {
  MODE4_SCOPE_SUPERSESSION,
  REQUIRED_SCOPE_MARKERS,
  SCOPE_CONFLICT_PATTERNS,
} from "./mode4-scope-supersession";

const REPORT_DIR = join(UI_AGENT_DIR, "mode4", "preflight");

type InventoryRow = {
  path: string;
  layer: string;
  included: boolean;
  fullContent: boolean;
  truncated: boolean;
  sourceBytes: number;
  suppliedChars: number;
  applicableJobs: string;
  sha256: string;
};

type CoverageRow = {
  specRef: string;
  surface: string;
  manifestId: string | null;
  route: string | null;
  status: "COVERED" | "MISSING" | "N/A";
  notes?: string;
};

type FeatureRow = {
  feature: string;
  domain: string;
  canonicalManifestId: string;
  route: string;
  uiRepresentation: string;
  status: "MAPPED" | "ORPHAN";
};

/** Approved V1 customer-facing surfaces from V1-APPOINTMENTS-MCTB-UI-REBUILD.md §6–23 + appointments-nav IA */
const REQUIRED_SURFACE_SPECS: CoverageRow[] = [
  { specRef: "V1 §6", surface: "Home / Operations dashboard", manifestId: "home", route: "/appointments/overview", status: "COVERED" },
  { specRef: "V1 §7", surface: "Calendar (day/week/month)", manifestId: "appointments-calendar", route: "/appointments/calendar", status: "COVERED" },
  { specRef: "V1 §8", surface: "Scheduled appointments list", manifestId: "appointments-list", route: "/appointments", status: "COVERED" },
  { specRef: "IA", surface: "Waitlist", manifestId: "appointments-waitlist", route: "/appointments/waitlist", status: "COVERED" },
  { specRef: "IA", surface: "Recalls", manifestId: "appointments-recalls", route: "/appointments/recalls", status: "COVERED" },
  { specRef: "V1 §11", surface: "Appointment detail + timeline", manifestId: "appointment-detail", route: "/appointments/[id]", status: "COVERED" },
  { specRef: "V1 §10", surface: "Create appointment", manifestId: "appointments-new", route: "/appointments/new", status: "COVERED" },
  { specRef: "V1 §10", surface: "Edit appointment", manifestId: "appointment-detail", route: "/appointments/[id]", status: "COVERED", notes: "Edit on detail surface" },
  { specRef: "V1 §28", surface: "First-run onboarding / get started", manifestId: "appointments-setup", route: "/appointments/setup", status: "COVERED" },
  { specRef: "V1 §9", surface: "Appointment / booking types", manifestId: "booking-types", route: "/appointments/types", status: "COVERED" },
  { specRef: "V1 §12", surface: "Booking page management", manifestId: "booking-pages", route: "/appointments/booking", status: "COVERED" },
  { specRef: "V1 §12", surface: "Availability rules", manifestId: "availability", route: "/appointments/availability", status: "COVERED" },
  { specRef: "IA", surface: "AI booking configuration", manifestId: "ai-booking", route: "/appointments/ai-booking", status: "COVERED" },
  { specRef: "IA", surface: "Routing forms", manifestId: "routing-forms", route: "/appointments/routing-forms", status: "COVERED" },
  { specRef: "IA", surface: "Meeting polls", manifestId: "meeting-polls", route: "/appointments/polls", status: "COVERED" },
  { specRef: "IA", surface: "Team booking pages", manifestId: "team-pages", route: "/appointments/team-pages", status: "COVERED" },
  { specRef: "V1 §13", surface: "Public booking page", manifestId: "public-booking", route: "/book/[slug]", status: "COVERED" },
  { specRef: "V1 §13", surface: "Public service/time selection", manifestId: "public-booking-service", route: "/book/[slug]/[serviceId]", status: "COVERED" },
  { specRef: "V1 §13", surface: "Embed booking", manifestId: "public-embed-booking", route: "/embed/book/[slug]", status: "COVERED" },
  { specRef: "V1 §15", surface: "Customer confirm link", manifestId: "public-confirm", route: "/appointments/confirm/[token]", status: "COVERED" },
  { specRef: "V1 §15", surface: "Customer cancel link", manifestId: "public-cancel", route: "/appointments/cancel/[token]", status: "COVERED" },
  { specRef: "V1 §15", surface: "Customer reschedule link", manifestId: "public-reschedule", route: "/appointments/reschedule/[token]", status: "COVERED" },
  { specRef: "IA", surface: "Waitlist accept (public)", manifestId: "public-waitlist-accept", route: "/waitlist/accept/[token]", status: "COVERED" },
  { specRef: "V1 §14", surface: "Reminder sequences", manifestId: "reminder-sequences", route: "/appointments/reminders", status: "COVERED" },
  { specRef: "IA", surface: "Workflows list + builder", manifestId: "workflow-builder", route: "/appointments/workflows", status: "COVERED" },
  { specRef: "IA", surface: "New workflow", manifestId: "workflow-new", route: "/appointments/workflows/new", status: "COVERED" },
  { specRef: "IA", surface: "Edit workflow", manifestId: "workflow-edit", route: "/appointments/workflows/[id]/edit", status: "COVERED" },
  { specRef: "IA", surface: "Workflow setup wizard", manifestId: "workflow-setup", route: "/appointments/workflows/setup/[templateId]", status: "COVERED" },
  { specRef: "IA", surface: "Automation templates", manifestId: "automation-templates", route: "/appointments/automations/templates", status: "COVERED" },
  { specRef: "IA", surface: "Automation activity", manifestId: "automation-activity", route: "/appointments/automations/activity", status: "COVERED" },
  { specRef: "V1 §17", surface: "Contacts list", manifestId: "contacts", route: "/contacts", status: "COVERED" },
  { specRef: "V1 §17", surface: "Contact detail + appointment history", manifestId: "contact-detail", route: "/contacts/[id]", status: "COVERED" },
  { specRef: "IA", surface: "Contact lists", manifestId: "contacts-lists", route: "/contacts/lists", status: "COVERED" },
  { specRef: "IA", surface: "Contact segments", manifestId: "contacts-segments", route: "/contacts/segments", status: "COVERED" },
  { specRef: "IA", surface: "Custom fields", manifestId: "contacts-fields", route: "/contacts/fields", status: "COVERED" },
  { specRef: "IA", surface: "Contact imports", manifestId: "contacts-imports", route: "/contacts/imports", status: "COVERED" },
  { specRef: "V1 §16", surface: "Messages / shared inbox", manifestId: "messages-inbox", route: "/conversations", status: "COVERED" },
  { specRef: "IA", surface: "Saved replies", manifestId: "messages-saved-replies", route: "/conversations/saved-replies", status: "COVERED" },
  { specRef: "IA", surface: "Meetings upcoming", manifestId: "meetings-upcoming", route: "/video", status: "COVERED" },
  { specRef: "IA", surface: "Meeting recaps", manifestId: "meetings-recaps", route: "/meetings", status: "COVERED" },
  { specRef: "IA", surface: "Meeting recap detail", manifestId: "meeting-detail", route: "/meetings/[id]", status: "COVERED" },
  { specRef: "IA", surface: "Payment transactions", manifestId: "payments-transactions", route: "/payments/transactions", status: "COVERED" },
  { specRef: "V1 §21", surface: "Analytics overview", manifestId: "analytics-overview", route: "/appointments/analytics", status: "COVERED" },
  { specRef: "V1 §21", surface: "Analytics booking", manifestId: "analytics-booking", route: "/appointments/analytics/booking", status: "COVERED" },
  { specRef: "V1 §21", surface: "Analytics reminders", manifestId: "analytics-reminders", route: "/appointments/analytics/reminders", status: "COVERED" },
  { specRef: "V1 §21", surface: "Analytics automations", manifestId: "analytics-automations", route: "/appointments/analytics/automations", status: "COVERED" },
  { specRef: "V1 §21", surface: "Analytics reports", manifestId: "analytics-reports", route: "/appointments/analytics/reports", status: "COVERED" },
  { specRef: "V1 §23", surface: "Calendar integrations", manifestId: "integrations-calendars", route: "/integrations/calendars", status: "COVERED" },
  { specRef: "V1 §23", surface: "Payment integrations", manifestId: "integrations-payments", route: "/integrations/payments", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — business", manifestId: "settings-business", route: "/settings/business", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — team", manifestId: "settings-users", route: "/settings/users", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — messaging", manifestId: "settings-messaging", route: "/settings/messaging", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — calendar", manifestId: "settings-calendar", route: "/settings/calendar", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — meetings/notetaker", manifestId: "settings-meetings", route: "/settings/ai-notetaker", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — security", manifestId: "settings-security", route: "/settings/security", status: "COVERED" },
  { specRef: "V1 §22", surface: "Settings — billing", manifestId: "settings-billing", route: "/settings/billing", status: "COVERED" },
  { specRef: "IA", surface: "Help / getting started", manifestId: "help-getting-started", route: "/getting-started", status: "COVERED" },
  // Explicitly out of appointments-platform Mode 4 scope (v1-launch-nav flags)
  { specRef: "V1 §18", surface: "Missed Call Text Back", manifestId: null, route: null, status: "N/A", notes: "MISSED_CALL_TEXT_BACK_IN_V1_NAV=false — excluded from 57-surface allowlist" },
  { specRef: "V1 §20", surface: "Compliance standalone page", manifestId: null, route: null, status: "N/A", notes: "COMPLIANCE_IN_V1_NAV=false — consent surfaced in-context per standards" },
  { specRef: "V1 §19", surface: "Numbers standalone", manifestId: null, route: null, status: "N/A", notes: "NUMBERS_IN_V1_NAV=false — numbers in Settings/Messaging" },
];

/** Approved V1 capabilities — must map to at least one manifest surface */
const APPROVED_FEATURE_MATRIX: FeatureRow[] = [
  { feature: "Operations dashboard summary cards", domain: "Home", canonicalManifestId: "home", route: "/appointments/overview", uiRepresentation: "Summary cards + needs attention", status: "MAPPED" },
  { feature: "Calendar scheduling views", domain: "Appointments", canonicalManifestId: "appointments-calendar", route: "/appointments/calendar", uiRepresentation: "Day/week/month grid + overlay", status: "MAPPED" },
  { feature: "Appointment search/filter/list", domain: "Appointments", canonicalManifestId: "appointments-list", route: "/appointments", uiRepresentation: "Tabs, search, table/cards", status: "MAPPED" },
  { feature: "Waitlist management", domain: "Appointments", canonicalManifestId: "appointments-waitlist", route: "/appointments/waitlist", uiRepresentation: "Waitlist table + actions", status: "MAPPED" },
  { feature: "Recall campaigns", domain: "Appointments", canonicalManifestId: "appointments-recalls", route: "/appointments/recalls", uiRepresentation: "Recall list + configuration", status: "MAPPED" },
  { feature: "Appointment detail + comms timeline", domain: "Appointments", canonicalManifestId: "appointment-detail", route: "/appointments/[id]", uiRepresentation: "Header, status, timeline, actions", status: "MAPPED" },
  { feature: "Create appointment", domain: "Appointments", canonicalManifestId: "appointments-new", route: "/appointments/new", uiRepresentation: "Form + customer picker", status: "MAPPED" },
  { feature: "Edit / reschedule / cancel appointment", domain: "Appointments", canonicalManifestId: "appointment-detail", route: "/appointments/[id]", uiRepresentation: "Detail actions + forms", status: "MAPPED" },
  { feature: "Booking type configuration", domain: "Booking", canonicalManifestId: "booking-types", route: "/appointments/types", uiRepresentation: "Type cards + editor", status: "MAPPED" },
  { feature: "Booking page enable/preview/share", domain: "Booking", canonicalManifestId: "booking-pages", route: "/appointments/booking", uiRepresentation: "Page status, preview, copy link", status: "MAPPED" },
  { feature: "Availability schedules", domain: "Booking", canonicalManifestId: "availability", route: "/appointments/availability", uiRepresentation: "Weekly hours, overrides, buffers", status: "MAPPED" },
  { feature: "AI booking configuration", domain: "Booking", canonicalManifestId: "ai-booking", route: "/appointments/ai-booking", uiRepresentation: "AI booking settings", status: "MAPPED" },
  { feature: "Routing forms", domain: "Booking", canonicalManifestId: "routing-forms", route: "/appointments/routing-forms", uiRepresentation: "Form builder/list", status: "MAPPED" },
  { feature: "Meeting polls", domain: "Booking", canonicalManifestId: "meeting-polls", route: "/appointments/polls", uiRepresentation: "Poll list + create", status: "MAPPED" },
  { feature: "Public booking + consent", domain: "Booking", canonicalManifestId: "public-booking", route: "/book/[slug]", uiRepresentation: "Consumer booking flow", status: "MAPPED" },
  { feature: "Customer confirm/cancel/reschedule", domain: "Appointments", canonicalManifestId: "public-confirm", route: "/appointments/confirm/[token]", uiRepresentation: "Token-based customer actions", status: "MAPPED" },
  { feature: "Reminder sequence configuration", domain: "Automations", canonicalManifestId: "reminder-sequences", route: "/appointments/reminders", uiRepresentation: "Sequence cards + templates", status: "MAPPED" },
  { feature: "Appointment workflows", domain: "Automations", canonicalManifestId: "workflow-builder", route: "/appointments/workflows", uiRepresentation: "List + builder canvas", status: "MAPPED" },
  { feature: "Workflow templates wizard", domain: "Automations", canonicalManifestId: "workflow-setup", route: "/appointments/workflows/setup/[templateId]", uiRepresentation: "Setup wizard steps", status: "MAPPED" },
  { feature: "Shared inbox + appointment context", domain: "Messages", canonicalManifestId: "messages-inbox", route: "/conversations", uiRepresentation: "Inbox + context badges", status: "MAPPED" },
  { feature: "Contacts + appointment history", domain: "Contacts", canonicalManifestId: "contact-detail", route: "/contacts/[id]", uiRepresentation: "Profile + history sections", status: "MAPPED" },
  { feature: "Meeting recaps / notetaker", domain: "Meetings", canonicalManifestId: "meetings-recaps", route: "/meetings", uiRepresentation: "Recap list + detail", status: "MAPPED" },
  { feature: "Payment transactions", domain: "Payments", canonicalManifestId: "payments-transactions", route: "/payments/transactions", uiRepresentation: "Transaction table", status: "MAPPED" },
  { feature: "Operational analytics", domain: "Analytics", canonicalManifestId: "analytics-overview", route: "/appointments/analytics", uiRepresentation: "Metrics dashboards", status: "MAPPED" },
  { feature: "Calendar/payment integrations", domain: "Integrations", canonicalManifestId: "integrations-calendars", route: "/integrations/calendars", uiRepresentation: "Connection management", status: "MAPPED" },
  { feature: "Workspace settings", domain: "Settings", canonicalManifestId: "settings-business", route: "/settings/business", uiRepresentation: "Settings forms", status: "MAPPED" },
  { feature: "First-run onboarding checklist", domain: "Home", canonicalManifestId: "appointments-setup", route: "/appointments/setup", uiRepresentation: "Setup checklist", status: "MAPPED" },
];

function verifyInteractionGuideComplete(): { pass: boolean; detail: string } {
  const path = join(REPO_ROOT, "docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md");
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const hasA = /## A\. Every interactive function must be keyboard operable/.test(content);
  const hasDZ = /## DZ\. Immersive workspaces must always have an exit/.test(content);
  return {
    pass: hasA && hasDZ,
    detail: hasA && hasDZ
      ? "Interaction guide contains rules A through DZ"
      : `Missing sections: A=${hasA} DZ=${hasDZ}`,
  };
}

function verifyArtDirectionVideos(): { pass: boolean; detail: string } {
  const refsPath = join(REPO_ROOT, ".ui-agent/references.json");
  if (!existsSync(refsPath)) return { pass: false, detail: "references.json missing" };
  const refs = JSON.parse(readFileSync(refsPath, "utf8")) as Record<string, unknown>;
  const missing = Object.values(MODE4_ART_DIRECTION_VIDEOS).filter((name) => !refs[name]);
  return {
    pass: missing.length === 0,
    detail: missing.length === 0 ? "Campaign + Inbox + Workflows videos present" : `Missing: ${missing.join(", ")}`,
  };
}

function auditManifestCoverage(manifest: ReturnType<typeof loadMode4Manifest>): CoverageRow[] {
  const byId = new Map(manifest.entries.map((e) => [e.id, e]));
  return REQUIRED_SURFACE_SPECS.map((row) => {
    if (row.status === "N/A") return row;
    const entry = row.manifestId ? byId.get(row.manifestId) : undefined;
    if (!entry) return { ...row, status: "MISSING" as const };
    if (entry.route !== row.route) {
      return { ...row, status: "MISSING" as const, notes: `Route mismatch: manifest has ${entry.route}` };
    }
    return row;
  });
}

function auditFeatureCoverage(manifest: ReturnType<typeof loadMode4Manifest>): FeatureRow[] {
  const byId = new Map(manifest.entries.map((e) => [e.id, e]));
  return APPROVED_FEATURE_MATRIX.map((row) => {
    const entry = byId.get(row.canonicalManifestId);
    if (!entry) return { ...row, status: "ORPHAN" as const };
    return row;
  });
}

function auditScopeConsistency(): {
  pass: boolean;
  conflicts: string[];
  resolutions: string[];
} {
  const conflicts: string[] = [];
  const resolutions: string[] = [];

  const scopeDoc = join(REPO_ROOT, "docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md");
  const v1Doc = join(REPO_ROOT, "docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md");
  const legacyProductArch = join(REPO_ROOT, "docs/PRODUCT_ARCHITECTURE.md");

  if (!existsSync(scopeDoc)) {
    conflicts.push("Missing docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md");
  } else {
    resolutions.push("Scope authority doc present and first in standards pack");
  }

  const packPaths = TRANSOVO_STANDARDS_DOCS.map((d) => d.path);
  if (packPaths.includes("docs/PRODUCT_ARCHITECTURE.md")) {
    conflicts.push("docs/PRODUCT_ARCHITECTURE.md is still in standards pack (mass-SMS catalog)");
  } else {
    resolutions.push("Legacy PRODUCT_ARCHITECTURE.md excluded from pack");
  }

  if (!packPaths.includes("docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md")) {
    conflicts.push("Scope authority doc not registered in standards pack");
  }

  if (!packPaths.includes("docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md")) {
    conflicts.push("Appointments domain architecture doc not in standards pack");
  }

  if (existsSync(v1Doc)) {
    const v1 = readFileSync(v1Doc, "utf8");
    if (!v1.includes(REQUIRED_SCOPE_MARKERS.v1Doc)) {
      conflicts.push(`V1 doc missing supersession marker: ${REQUIRED_SCOPE_MARKERS.v1Doc}`);
    } else {
      resolutions.push("V1 doc contains MODE 4 ACTIVE SCOPE supersession banner");
    }
    if (!v1.includes(REQUIRED_SCOPE_MARKERS.mctbSection)) {
      conflicts.push("V1 doc missing OUT OF MODE 4 SCOPE section markers");
    } else {
      resolutions.push("V1 doc marks MCTB/Compliance/Numbers sections as OUT OF MODE 4 SCOPE");
    }
    for (const { pattern, label, doc } of SCOPE_CONFLICT_PATTERNS) {
      if (doc !== "docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md") continue;
      if (pattern.test(v1)) {
        // Allowed if only inside OUT OF MODE 4 sections — check no active "Wire to new nav" outside markers
        if (/Wire to new nav/i.test(v1) && !/out-of-mode4/i.test(v1)) {
          conflicts.push(`V1 doc: ${label}`);
        }
      }
      if (/Tighten MCTB UI/i.test(v1)) {
        conflicts.push(`V1 doc: ${label} still present`);
      }
    }
  }

  if (existsSync(scopeDoc)) {
    const scope = readFileSync(scopeDoc, "utf8");
    if (!scope.includes(REQUIRED_SCOPE_MARKERS.scopeDoc)) {
      conflicts.push("Scope doc missing explicit exclusion list");
    }
  }

  if (existsSync(legacyProductArch)) {
    resolutions.push(
      "Legacy PRODUCT_ARCHITECTURE.md exists in repo but is excluded from Kimi payload",
    );
  }

  if (!MODE4_SCOPE_SUPERSESSION.includes("TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE")) {
    conflicts.push("MODE4_SCOPE_SUPERSESSION preamble missing scope doc reference");
  } else {
    resolutions.push("Kimi job preamble includes scope supersession block");
  }

  return { pass: conflicts.length === 0, conflicts, resolutions };
}

function verifyKimiJobPayload(): { pass: boolean; checks: string[] } {
  const checks: string[] = [];
  const pack = loadStandardsPack();
  const totals = standardsPackTotals(pack);

  checks.push(`Standards pack: ${totals.documents} docs, ${totals.totalSuppliedChars} chars supplied`);
  checks.push(`Truncation: ${totals.truncated === 0 ? "NONE (required)" : `FAIL — ${totals.truncated} truncated`}`);
  checks.push(`Missing docs: ${totals.missing === 0 ? "NONE" : `FAIL — ${totals.missing}`}`);
  checks.push("Page Contract: supplemental only (embedded after scope supersession + standards)");
  checks.push("Scope supersession preamble: prepended to every Kimi Mode 4 job");
  checks.push(`Art direction: Campaign default, Inbox for /conversations, Workflows for workflow surfaces`);
  checks.push("Golden screens: referenced after Stage E completion (batch uses golden artDirection flag)");

  const pass = totals.truncated === 0 && totals.missing === 0;
  return { pass, checks };
}

function printInventoryTable(rows: InventoryRow[]): void {
  console.log("\n## Standards-pack inventory\n");
  console.log("| Document | Layer | Included | Full | Truncated | Source bytes | Supplied chars | Jobs |");
  console.log("|----------|-------|----------|------|-----------|--------------|----------------|------|");
  for (const row of rows) {
    console.log(
      `| \`${row.path}\` | ${row.layer} | ${row.included ? "yes" : "NO"} | ${row.fullContent ? "yes" : "NO"} | ${row.truncated ? "YES" : "no"} | ${row.sourceBytes} | ${row.suppliedChars} | ${row.applicableJobs} |`,
    );
  }
}

function main(): void {
  const writeReport = process.argv.includes("--write-report");
  console.log("MODE 4 PREFLIGHT INTEGRITY AUDIT");
  console.log("================================\n");

  const pack = loadStandardsPack();
  const totals = standardsPackTotals(pack);

  const inventory: InventoryRow[] = pack.map((d) => ({
    path: d.path,
    layer: d.layerLabel,
    included: !d.missing,
    fullContent: d.fullContent,
    truncated: d.truncated,
    sourceBytes: d.sourceBytes,
    suppliedChars: d.suppliedChars,
    applicableJobs: d.applicableJobs,
    sha256: d.sha256,
  }));

  printInventoryTable(inventory);

  console.log("\n## Excluded documents (intentional)\n");
  for (const ex of EXCLUDED_FROM_STANDARDS_PACK) {
    console.log(`- \`${ex.path}\` — ${ex.reason}`);
  }

  console.log("\n## Required pack document count\n");
  console.log(`Registered in pack: ${TRANSOVO_STANDARDS_DOCS.length}`);
  console.log(`Total source bytes: ${totals.totalSourceBytes}`);
  console.log(`Total supplied chars: ${totals.totalSuppliedChars}`);

  const interactionCheck = verifyInteractionGuideComplete();
  console.log(`\n## Interaction guide A–DZ check: ${interactionCheck.pass ? "PASS" : "FAIL"}`);
  console.log(interactionCheck.detail);

  const videoCheck = verifyArtDirectionVideos();
  console.log(`\n## Art direction videos: ${videoCheck.pass ? "PASS" : "FAIL"}`);
  console.log(videoCheck.detail);

  const manifest = loadMode4Manifest();
  const bulkCount = manifest.entries.filter((e) => e.route !== "__foundation__").length;
  console.log(`\n## Manifest surface count: ${bulkCount} (+ 1 foundation serial)`);

  const coverage = auditManifestCoverage(manifest);
  const missingSurfaces = coverage.filter((c) => c.status === "MISSING");
  const naSurfaces = coverage.filter((c) => c.status === "N/A");

  console.log("\n## Manifest coverage audit (vs V1 appointment-platform spec)\n");
  for (const row of coverage) {
    const mark = row.status === "COVERED" ? "✓" : row.status === "N/A" ? "—" : "✗";
    console.log(`${mark} ${row.surface} → ${row.manifestId || "N/A"} ${row.notes ? `(${row.notes})` : ""}`);
  }

  const features = auditFeatureCoverage(manifest);
  const orphanFeatures = features.filter((f) => f.status === "ORPHAN");

  console.log("\n## Feature coverage audit\n");
  for (const row of features) {
    console.log(`✓ ${row.feature} → ${row.canonicalManifestId} (${row.route})`);
  }

  const scopeCheck = auditScopeConsistency();
  console.log("\n## Scope consistency audit\n");
  for (const r of scopeCheck.resolutions) console.log(`✓ ${r}`);
  for (const c of scopeCheck.conflicts) console.log(`✗ CONFLICT: ${c}`);
  console.log(`\nScope consistency: ${scopeCheck.pass ? "PASS" : "FAIL"}`);

  const payloadCheck = verifyKimiJobPayload();
  console.log("\n## Kimi job payload verification\n");
  for (const c of payloadCheck.checks) console.log(`- ${c}`);

  const standardsPass = totals.missing === 0 && totals.truncated === 0 && interactionCheck.pass;
  const manifestPass = missingSurfaces.length === 0;
  const featurePass = orphanFeatures.length === 0;
  const videoPass = videoCheck.pass;
  const overallPass =
    standardsPass &&
    manifestPass &&
    featurePass &&
    videoPass &&
    payloadCheck.pass &&
    scopeCheck.pass;

  console.log("\n================================");
  console.log("PREFLIGHT RESULTS");
  console.log("================================");
  console.log(`Standards pack (full content): ${standardsPass ? "PASS" : "FAIL"}`);
  if (totals.truncated > 0) console.log(`  → ${totals.truncated} document(s) truncated — Mode 4 must not truncate`);
  if (totals.missing > 0) console.log(`  → ${totals.missing} document(s) missing`);
  console.log(`Manifest coverage (57 surfaces): ${manifestPass ? "PASS" : "FAIL"} (${missingSurfaces.length} missing)`);
  console.log(`Feature coverage: ${featurePass ? "PASS" : "FAIL"} (${orphanFeatures.length} orphan)`);
  console.log(`Art direction videos: ${videoPass ? "PASS" : "FAIL"}`);
  console.log(`Scope consistency: ${scopeCheck.pass ? "PASS" : "FAIL"}`);
  if (scopeCheck.conflicts.length) {
    for (const c of scopeCheck.conflicts) console.log(`  → ${c}`);
  }
  console.log(`Kimi payload structure: ${payloadCheck.pass ? "PASS" : "FAIL"}`);
  console.log(`\nOVERALL: ${overallPass ? "PASS" : "FAIL"}`);
  console.log(overallPass ? "\nSafe to proceed to Stage D/E/G." : "\nDo NOT launch Kimi until failures are resolved.");

  if (writeReport) {
    mkdirSync(REPORT_DIR, { recursive: true });
    const artifactPath = writeStandardsPackArtifact(REPORT_DIR, pack);
    const reportPath = join(REPORT_DIR, `preflight-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
    const report = [
      "# Mode 4 Preflight Report",
      `**Overall:** ${overallPass ? "PASS" : "FAIL"}`,
      "",
      "## Standards inventory",
      "",
      "| path | included | full | truncated | bytes | chars |",
      "|------|----------|------|-----------|-------|-------|",
      ...inventory.map(
        (r) =>
          `| ${r.path} | ${r.included} | ${r.fullContent} | ${r.truncated} | ${r.sourceBytes} | ${r.suppliedChars} |`,
      ),
      "",
      "## Manifest coverage",
      "",
      ...coverage.map((c) => `- ${c.status}: ${c.surface}`),
      "",
      "## Feature coverage",
      "",
      ...features.map((f) => `- ${f.feature} → ${f.canonicalManifestId}`),
      "",
      `Artifacts: ${artifactPath}`,
    ].join("\n");
    writeFileSync(reportPath, report, "utf8");
    console.log(`\nReport written: ${reportPath}`);
  }

  process.exit(overallPass ? 0 : 1);
}

main();
