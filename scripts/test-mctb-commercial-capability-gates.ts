/**
 * Static contract: commercial packages map to capability flags in resolveMctbCapabilities.
 * Run: npx tsx scripts/test-mctb-commercial-capability-gates.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const capabilitiesSrc = readFileSync(
  resolve(process.cwd(), "src/lib/mctb/capabilities.ts"),
  "utf8",
);

assert.match(capabilitiesSrc, /bookingLinks = recoveryPaid \|\| aiRecoveryEntitled/);
assert.match(capabilitiesSrc, /urgentClassification = aiRecoveryEntitled/);
assert.match(capabilitiesSrc, /pressOneConsent: mctbProductActive/);
assert.doesNotMatch(
  capabilitiesSrc,
  /existingConsentCertification =\s*\n\s*recoveryPaid &&/,
  "existing consent certification must not require paid Text Back",
);

const limitsSrc = readFileSync(
  resolve(process.cwd(), "src/lib/mctb/recovery-usage-constants.ts"),
  "utf8",
);
assert.equal(limitsSrc.includes("MCTB_FREE_MONTHLY_RECOVERY_LIMIT = 10"), true);
assert.equal(limitsSrc.includes("MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT = 50"), true);
assert.equal(limitsSrc.includes("MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT = 100"), true);

console.log("test-mctb-commercial-capability-gates: ok");
