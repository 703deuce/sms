#!/usr/bin/env node
/**
 * Static verification for MCTB-only extraction (no server required).
 * Confirms dormant product routes are gone and MCTB surfaces remain.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DORMANT_PRODUCTS, MCTB_ROUTES } from "./mctb-extraction-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DORMANT_ROUTE_SAMPLES = [
  "src/app/(app)/smart-routing/page.tsx",
  "src/app/(app)/smart-routing/layout.tsx",
  "src/app/(app)/realtor/page.tsx",
  "src/app/(app)/personal/page.tsx",
  "src/app/(app)/voice/agents/page.tsx",
  "src/app/(app)/voice/receptionist/page.tsx",
  "src/app/(app)/voice/campaigns/page.tsx",
  "src/app/(app)/grow/page.tsx",
  "src/app/api/smart-routing",
  "voice-runtime/package.json",
];

const MCTB_REQUIRED = [
  "src/lib/mctb/config.ts",
  "src/lib/mctb/consent-mode.ts",
  "src/lib/agents/missed-call-text-back/send.ts",
  "src/lib/solutions/missed-call-text-back/save.ts",
  "src/app/api/mctb/setup/route.ts",
  "src/app/api/telnyx/voice/mctb-consent/route.ts",
  "src/app/api/telnyx/voice/mctb-call-control/route.ts",
  "src/app/api/telnyx/voice/mctb-event-only/route.ts",
  "src/app/api/twilio/voice/mctb-ingress/route.ts",
  "src/app/(app)/voice/missed-calls/page.tsx",
  "src/app/(app)/voice/setup/page.tsx",
  "src/app/(app)/voice/consent-log/page.tsx",
  "src/lib/products/voice-nav.ts",
];

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

let failed = 0;

console.log("MCTB extraction static verification\n");

console.log("=== Dormant samples (must be absent) ===");
for (const rel of DORMANT_ROUTE_SAMPLES) {
  if (exists(rel)) {
    console.error(`FAIL still present: ${rel}`);
    failed++;
  } else {
    console.log(`ok absent: ${rel}`);
  }
}

console.log("\n=== MCTB core (must exist) ===");
for (const rel of MCTB_REQUIRED) {
  if (!exists(rel)) {
    console.error(`FAIL missing: ${rel}`);
    failed++;
  } else {
    console.log(`ok present: ${rel}`);
  }
}

console.log("\n=== MCTB voice pages ===");
const voicePages = [
  "missed-calls",
  "setup",
  "consent-log",
  "schedule",
  "try-it",
  "analytics",
  "numbers",
];
for (const page of voicePages) {
  const rel = `src/app/(app)/voice/${page}/page.tsx`;
  if (!exists(rel) && page !== "numbers") {
    console.error(`FAIL missing page: ${rel}`);
    failed++;
  } else if (exists(rel) || (page === "numbers" && exists("src/app/(app)/voice/numbers/page.tsx"))) {
    console.log(`ok present: voice/${page}`);
  }
}

console.log(`\nManifest: ${Object.keys(DORMANT_PRODUCTS).length} dormant product areas archived`);
console.log(`Production routes kept: ${MCTB_ROUTES.length} patterns in manifest`);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll static checks passed");
