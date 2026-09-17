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

function normalizeCertified(src: string, exportFrom: string, exportTo: string): string {
  return src
    .replaceAll('from "../../lib/', 'from "@/lib/')
    .replace(exportTo, exportFrom)
    .replace(/from "\.\.\/\.\.\/([^"]+)"/g, 'from "./$1"');
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

if (findNorm !== FIND_BASE) {
  console.error("FAIL: certified FIND diverged from baseline", BASE);
  process.exit(1);
}
if (bookNorm !== BOOK_BASE) {
  console.error("FAIL: certified BOOK diverged from baseline", BASE);
  process.exit(1);
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
