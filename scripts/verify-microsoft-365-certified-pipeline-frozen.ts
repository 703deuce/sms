#!/usr/bin/env npx tsx
/**
 * Ensures microsoft-365-certified pipeline files match git baseline 06125f5f (modulo export names + import paths).
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const BASE = "06125f5f";
const FIND_BASE = execSync(`git show ${BASE}:src/lib/voice-v2/find-availability.ts`, {
  encoding: "utf8",
});
const BOOK_BASE = execSync(`git show ${BASE}:src/lib/voice-v2/book-offered-slot.ts`, {
  encoding: "utf8",
});

function stripImports(src: string): string {
  return src
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .join("\n");
}

/** Map frozen internal modules back to baseline paths for logic-only comparison. */
const INTERNAL_TO_BASELINE: Record<string, string> = {
  "./internal/calendar-providers": "@/lib/voice/calendar/providers",
  "./internal/workspace-booking-config": "@/lib/mctb/ai-booking/config",
  "./internal/microsoft-connection": "@/lib/mctb/ai-booking/microsoft-connection",
  "./internal/slot-id": "@/lib/mctb/ai-booking/slot-id",
  "./internal/parse-booking-hours": "@/lib/solutions/appointment-receptionist/notice-utils",
  "./internal/timezone-slots": "@/lib/voice/calendar/timezone-slots",
  "./internal/validate-input": "./validate-input",
  "./internal/types": "./types",
  "./internal/graph-instrumentation": "./graph-instrumentation",
  "./internal/offer-set-store": "./offer-set-store",
};

function normalizeCertified(src: string, exportFrom: string, exportTo: string): string {
  let out = stripImports(src).replace(exportTo, exportFrom);
  for (const [internal, baseline] of Object.entries(INTERNAL_TO_BASELINE)) {
    out = out.replaceAll(`from "${internal}"`, `from "${baseline}"`);
  }
  return out;
}

const findCert = readFileSync(
  "src/lib/voice-v2/pipelines/microsoft-365-certified/find-availability.ts",
  "utf8",
);
const bookCert = readFileSync(
  "src/lib/voice-v2/pipelines/microsoft-365-certified/book-offered-slot.ts",
  "utf8",
);

const findNorm = normalizeCertified(
  findCert,
  "executeVoiceV2FindAvailability",
  "executeMicrosoft365CertifiedFindAvailability",
);
const bookNorm = normalizeCertified(
  bookCert,
  "executeVoiceV2BookOfferedSlot",
  "executeMicrosoft365CertifiedBookOfferedSlot",
);

const findBaseNorm = stripImports(FIND_BASE);
const bookBaseNorm = stripImports(BOOK_BASE);
if (findNorm !== findBaseNorm) {
  console.error("FAIL: certified FIND diverged from baseline", BASE);
  process.exit(1);
}
if (bookNorm !== bookBaseNorm) {
  console.error("FAIL: certified BOOK diverged from baseline", BASE);
  process.exit(1);
}

const forbiddenEntryImports = [
  "../offer-set-store",
  "../validate-input",
  "@/lib/voice-v2/find-availability",
  "@/lib/voice/calendar/providers",
];
for (const frag of forbiddenEntryImports) {
  if (findCert.includes(frag) || bookCert.includes(frag)) {
    console.error("FAIL: certified entry still imports shared booking path:", frag);
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
if (findRoute.includes("executeVoiceV2FindAvailability")) {
  console.error("FAIL: FIND route must not call extended executeVoiceV2FindAvailability");
  process.exit(1);
}
if (bookRoute.includes("executeVoiceV2BookOfferedSlot")) {
  console.error("FAIL: BOOK route must not call extended executeVoiceV2BookOfferedSlot");
  process.exit(1);
}

console.log(`verify-microsoft-365-certified-pipeline-frozen: PASS (${BASE})`);
