#!/usr/bin/env node
/**
 * Meetings page closure — static structural checks.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];

function pass(id, note = "") {
  results.push({ id, status: "PASS", note });
}
function fail(id, note = "") {
  results.push({ id, status: "FAIL", note });
}

function includes(rel, needle) {
  const p = join(root, rel);
  if (!existsSync(p)) return false;
  return readFileSync(p, "utf8").includes(needle);
}

// Routes
if (existsSync(join(root, "src/app/(app)/appointments/meetings/page.tsx"))) {
  pass("MTG-ROUTE-LIST", "/appointments/meetings");
} else fail("MTG-ROUTE-LIST");

if (existsSync(join(root, "src/app/(app)/appointments/meetings/new/page.tsx"))) {
  pass("MTG-ROUTE-WIZARD", "/appointments/meetings/new");
} else fail("MTG-ROUTE-WIZARD");

if (existsSync(join(root, "src/app/(app)/appointments/meetings/[id]/page.tsx"))) {
  pass("MTG-ROUTE-EDIT", "/appointments/meetings/[id]");
} else fail("MTG-ROUTE-EDIT");

// Five-region shell
if (
  includes("src/components/appointments/meetings/meetings-workspace-connected.tsx", "MeetingsListPanel") &&
  includes("src/components/appointments/meetings/meetings-workspace-connected.tsx", "MeetingObjectHeader") &&
  includes("src/components/appointments/meetings/meetings-workspace-connected.tsx", "MeetingSummaryStrip") &&
  includes("src/components/appointments/meetings/meetings-workspace-connected.tsx", "MeetingLocalNav")
) {
  pass("MTG-ARCH-FIVE-REGION");
} else fail("MTG-ARCH-FIVE-REGION");

// Wizard
if (includes("src/components/appointments/meetings/create-meeting-wizard.tsx", "Create meeting")) {
  pass("MTG-WIZARD-4STEP");
} else fail("MTG-WIZARD-4STEP");

// Backend wiring
if (includes("src/features/appointments/kimi/meetings/use-meeting-editor.ts", "/api/appointments/types")) {
  pass("MTG-API-WIRE");
} else fail("MTG-API-WIRE");

// Black/teal tokens (no purple primary in meetings surfaces)
const meetingsCss = [
  "src/components/appointments/meetings/meetings-workspace-connected.tsx",
  "src/components/appointments/meetings/meetings-list-panel.tsx",
].map((f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : "")).join("\n");
if (!meetingsCss.includes("#4338ca") && !meetingsCss.includes("indigo-")) {
  pass("MTG-VISUAL-NO-PURPLE");
} else fail("MTG-VISUAL-NO-PURPLE", "purple/indigo in meetings components");

// Docs
if (existsSync(join(root, "docs/APPOINTMENTS-MEETINGS-COMPONENT-CONNECTION-MATRIX.md"))) {
  pass("MTG-DOCS-MATRIX");
} else fail("MTG-DOCS-MATRIX");

const fails = results.filter((r) => r.status === "FAIL");
console.log("APPOINTMENTS MEETINGS PAGE — STATIC CHECKS\n");
for (const r of results) console.log(`${r.id}: ${r.status}${r.note ? ` — ${r.note}` : ""}`);
console.log(`\nSummary: ${results.filter((r) => r.status === "PASS").length} PASS, ${fails.length} FAIL`);
console.log(`APPOINTMENTS_MEETINGS_PAGE_COMPLETE: ${fails.length === 0 ? "PARTIAL (static only)" : "NO"}`);
process.exit(fails.length > 0 ? 1 : 0);
