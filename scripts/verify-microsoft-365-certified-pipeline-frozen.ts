#!/usr/bin/env npx tsx
/**
 * Microsoft 365 certified pipeline guards:
 * - isolated entry points + Telnyx routes
 * - authoritative local ledger (Graph + classified Transovo rows) — not naive 06125f5f ledger
 * - internal ledger classifier tests
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const GRAPH_BASELINE = "06125f5f";

const findCert = readFileSync(
  "src/lib/voice-v2/pipelines/microsoft-365-certified/find-availability.ts",
  "utf8",
);
const bookCert = readFileSync(
  "src/lib/voice-v2/pipelines/microsoft-365-certified/book-offered-slot.ts",
  "utf8",
);

if (
  !findCert.includes("listReconciledVoiceAppointmentBusyIntervals") ||
  !findCert.includes("mergeProviderBusyWithReconciledLedger")
) {
  console.error("FAIL: certified FIND must merge Graph busy with reconciled local ledger");
  process.exit(1);
}
if (!bookCert.includes("findReconciledVoiceAppointmentConflict")) {
  console.error("FAIL: certified BOOK must use reconciled local ledger conflict check");
  process.exit(1);
}
if (bookCert.includes("voiceAppointment.findFirst")) {
  console.error("FAIL: certified BOOK must not use naive voiceAppointment.findFirst overlap");
  process.exit(1);
}

const forbiddenEntryImports = [
  "../offer-set-store",
  "@/lib/voice-v2/find-availability",
  "@/lib/voice/calendar/providers",
  "voice-appointment-reconcile",
];
for (const frag of forbiddenEntryImports) {
  if (findCert.includes(frag) || bookCert.includes(frag)) {
    console.error("FAIL: certified entry imports shared booking path:", frag);
    process.exit(1);
  }
}

const findRoute = readFileSync("src/app/api/telnyx/voice-v2/find-availability/route.ts", "utf8");
const bookRoute = readFileSync("src/app/api/telnyx/voice-v2/book-offered-slot/route.ts", "utf8");
if (!findRoute.includes("executeMicrosoft365CertifiedFindAvailability")) {
  console.error("FAIL: FIND route must call microsoft-365-certified pipeline only");
  process.exit(1);
}
if (!bookRoute.includes("executeMicrosoft365CertifiedBookOfferedSlot")) {
  console.error("FAIL: BOOK route must call microsoft-365-certified pipeline only");
  process.exit(1);
}
if (findRoute.includes("patchWorkflowAfterFind") || findRoute.includes("ensureVoiceV2CallContext")) {
  console.error("FAIL: FIND route must not attach workflow/CallContext on certified path");
  process.exit(1);
}

execSync("npx tsx scripts/test-microsoft-365-certified-local-ledger.ts", {
  stdio: "inherit",
});
execSync("npx tsx scripts/audit-microsoft-365-certified-booking-imports.ts", {
  stdio: "inherit",
});

console.log(
  `verify-microsoft-365-certified-pipeline-frozen: PASS (Graph core ${GRAPH_BASELINE} + authoritative local ledger)`,
);
