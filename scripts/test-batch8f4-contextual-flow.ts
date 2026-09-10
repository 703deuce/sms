/**
 * Batch 8F-4 — slot diagnostics contextual flow static verification.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const requiredFiles = [
  "src/features/appointments/kimi/availability/SlotDiagnosticsDrawer.tsx",
  "src/features/appointments/kimi/availability/SlotDiagnosticsPanel.tsx",
  "src/features/appointments/kimi/availability/slot-diagnostics-types.ts",
  "src/features/appointments/kimi/availability/datetime-local.ts",
  "src/components/appointments/kimi-ui/appointment-types/components/TypeEditorPanel.tsx",
  "src/features/appointments/kimi/appointment-types/appointment-types-connected.tsx",
  "src/components/appointments/kimi-ui/calendar/components/CalendarHeader.tsx",
  "src/features/appointments/kimi/calendar/calendar-connected.tsx",
];

let failed = 0;
for (const rel of requiredFiles) {
  const ok = existsSync(join(ROOT, rel));
  console.log(ok ? "PASS" : "FAIL", rel);
  if (!ok) failed += 1;
}

const typeEditor = readFileSync(
  join(ROOT, "src/components/appointments/kimi-ui/appointment-types/components/TypeEditorPanel.tsx"),
  "utf8",
);
if (typeEditor.includes("onCheckAvailability") && typeEditor.includes("Check availability")) {
  console.log("PASS type editor contextual entry");
} else {
  console.log("FAIL type editor contextual entry");
  failed += 1;
}

const typesConnected = readFileSync(
  join(ROOT, "src/features/appointments/kimi/appointment-types/appointment-types-connected.tsx"),
  "utf8",
);
if (
  typesConnected.includes("SlotDiagnosticsDrawer") &&
  typesConnected.includes("lockServiceName") &&
  typesConnected.includes("onCheckAvailability")
) {
  console.log("PASS type editor drawer wiring with draft preservation");
} else {
  console.log("FAIL type editor drawer wiring with draft preservation");
  failed += 1;
}

const calendarHeader = readFileSync(
  join(ROOT, "src/components/appointments/kimi-ui/calendar/components/CalendarHeader.tsx"),
  "utf8",
);
if (calendarHeader.includes("Check availability") && calendarHeader.includes("onCheckAvailability")) {
  console.log("PASS calendar contextual entry");
} else {
  console.log("FAIL calendar contextual entry");
  failed += 1;
}

const panel = readFileSync(
  join(ROOT, "src/features/appointments/kimi/availability/SlotDiagnosticsPanel.tsx"),
  "utf8",
);
if (
  panel.includes("staffOptions") &&
  panel.includes("lockServiceName") &&
  panel.includes("/api/appointments/diagnostics/slots")
) {
  console.log("PASS slot diagnostics panel prefill + authoritative API");
} else {
  console.log("FAIL slot diagnostics panel prefill + authoritative API");
  failed += 1;
}

const reconcile = readFileSync(join(ROOT, "scripts/reconcile-appointments-batch8c.mjs"), "utf8");
if (reconcile.includes("detectSlotDiagnosticsContextualEvidence")) {
  console.log("PASS reconcile evidence detection");
} else {
  console.log("FAIL reconcile evidence detection");
  failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nBatch 8F-4 static verification: PASS");
