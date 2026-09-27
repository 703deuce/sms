#!/usr/bin/env npx tsx
/**
 * Narrow CONFIGURED_NOT_IMPLEMENTED manifest rows to launch classifications.
 * Output: markdown summary + JSON artifact for Phase 20 reporting.
 */
import fs from "node:fs";
import path from "node:path";
import { WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS } from "../src/lib/voice-v3/config/wizard-control-inventory";
import { WIZARD_V3_FIELD_MANIFEST } from "../src/lib/voice-v3/config/wizard-v3-field-manifest";
import { WIZARD_V3_MANIFEST_SUMMARY } from "../src/lib/voice-v3/config/wizard-v3-field-manifest";
import {
  resolveLaunchClassification,
  type WizardV3LaunchClassification,
} from "../src/lib/voice-v3/config/wizard-v3-runtime-launch-classification";

const manifestByPath = new Map(WIZARD_V3_FIELD_MANIFEST.map((r) => [r.statePath, r]));

type RowOut = {
  statePath: string;
  step: number;
  uiLabel: string;
  manifestExecutionStatus: string;
  launchClassification: WizardV3LaunchClassification;
  evidence: string;
};

const rows: RowOut[] = WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.map((statePath) => {
  const m = manifestByPath.get(statePath);
  const c = resolveLaunchClassification(statePath, m?.executionStatus ?? "UNKNOWN");
  return {
    statePath,
    step: m?.step ?? 0,
    uiLabel: m?.uiLabel ?? statePath,
    manifestExecutionStatus: m?.executionStatus ?? "UNKNOWN",
    launchClassification: c.classification,
    evidence: c.evidence,
  };
});

const byClass: Record<WizardV3LaunchClassification, RowOut[]> = {
  CURRENT_VISIBLE_IMPLEMENTED: [],
  CURRENT_VISIBLE_STILL_BROKEN: [],
  CHILD_IMPLEMENTED_BY_PARENT: [],
  CONTROL_PLANE_ACTIVE: [],
  HIDDEN_STATE_ONLY: [],
  OUT_OF_SCOPE_RETIRED: [],
  MCTB_ONLY: [],
  LEGACY_OBSOLETE: [],
  UI_METADATA_ONLY: [],
};

for (const r of rows) {
  byClass[r.launchClassification].push(r);
}

const visibleControls = rows.filter(
  (r) =>
    !["OUT_OF_SCOPE_RETIRED", "HIDDEN_STATE_ONLY", "LEGACY_OBSOLETE", "MCTB_ONLY"].includes(
      r.launchClassification,
    ),
);

const visibleRuntimeAffecting = visibleControls.filter(
  (r) => r.launchClassification !== "UI_METADATA_ONLY",
);

const stillBroken = byClass.CURRENT_VISIBLE_STILL_BROKEN;

const lines: string[] = [];
lines.push("# Voice V3 — runtime launch gap report (narrowed)");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push("## E. Certification totals (manifest + launch classification)");
lines.push("");
lines.push(`| Metric | Count |`);
lines.push(`|--------|------:|`);
lines.push(`| Visible controls (customer-editable leaves) | ${visibleControls.length} |`);
lines.push(`| Visible runtime-affecting controls | ${visibleRuntimeAffecting.length} |`);
lines.push(`| Manifest ACTIVE_EXECUTION | ${WIZARD_V3_MANIFEST_SUMMARY.ACTIVE_EXECUTION} |`);
lines.push(`| Manifest LIVE_PROMPT_CONTROL | ${WIZARD_V3_MANIFEST_SUMMARY.LIVE_PROMPT_CONTROL} |`);
lines.push(`| Manifest CONFIGURED_NOT_IMPLEMENTED (exposed gap) | ${WIZARD_V3_MANIFEST_SUMMARY.CONFIGURED_NOT_IMPLEMENTED} |`);
lines.push(`| **VISIBLE_UNIMPLEMENTED (launch classification)** | **${stillBroken.length}** |`);
lines.push("");
lines.push("## B. Launch classification summary");
lines.push("");
for (const [k, v] of Object.entries(byClass)) {
  lines.push(`- **${k}**: ${v.length}`);
}
lines.push("");
lines.push("## D. Remaining launch blockers (visible, still broken)");
lines.push("");
if (!stillBroken.length) {
  lines.push("_None classified as CURRENT_VISIBLE_STILL_BROKEN._");
} else {
  for (const r of stillBroken) {
    lines.push(`- Step ${r.step} \`${r.statePath}\` — ${r.evidence}`);
  }
}
lines.push("");
lines.push("## Send Booking Link (P0)");
lines.push("");
const linkUrl = rows.find((r) => r.statePath === "bookingLinkUrl");
const linkLabel = rows.find((r) => r.statePath === "bookingLinkLabel");
lines.push(
  `- bookingLinkUrl: ${linkUrl?.launchClassification} (manifest: ${linkUrl?.manifestExecutionStatus})`,
);
lines.push(
  `- bookingLinkLabel: ${linkLabel?.launchClassification} (manifest: ${linkLabel?.manifestExecutionStatus})`,
);
lines.push(
  "- Runtime: `send_booking_link` + `executeSendBookingLink` — contract: `npm run test:voice-v3-send-booking-link-matrix`",
);
lines.push("");

const outDir = process.env.ARTIFACT_DIR || "/opt/cursor/artifacts/voice-v3-runtime-launch-gaps";
fs.mkdirSync(outDir, { recursive: true });
const mdPath = path.join(outDir, "VOICE-V3-RUNTIME-LAUNCH-GAP-REPORT.md");
const jsonPath = path.join(outDir, "launch-gap-rows.json");
fs.writeFileSync(mdPath, lines.join("\n"));
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      summary: {
        visibleControls: visibleControls.length,
        visibleRuntimeAffecting: visibleRuntimeAffecting.length,
        visibleUnimplemented: stillBroken.length,
        manifestSummary: WIZARD_V3_MANIFEST_SUMMARY,
      },
      stillBroken,
      byClass: Object.fromEntries(
        Object.entries(byClass).map(([k, v]) => [k, v.map((r) => r.statePath)]),
      ),
    },
    null,
    2,
  ),
);

console.log(lines.join("\n"));
console.log(`\nWrote ${mdPath}`);
if (stillBroken.length > 0) {
  console.error(`VISIBLE_UNIMPLEMENTED_CONTROLS=${stillBroken.length}`);
  process.exitCode = 1;
} else {
  console.log("VISIBLE_UNIMPLEMENTED_CONTROLS=0");
}
