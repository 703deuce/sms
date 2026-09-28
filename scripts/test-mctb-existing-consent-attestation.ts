import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { EXISTING_CONSENT_ATTESTATION_VERSION } from "../src/lib/mctb/capture/attestation";

const attestation = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/capture/attestation.ts"),
  "utf8",
);
assert.ok(attestation.includes("existingConsentAttestationHistory"));
assert.equal(EXISTING_CONSENT_ATTESTATION_VERSION, "1");

const setup = readFileSync(path.join(process.cwd(), "src/app/api/mctb/setup/route.ts"), "utf8");
assert.ok(setup.includes("isExistingConsentModeEligible"));
assert.ok(setup.includes("hasActiveMctbPaidEntitlement") || setup.includes("recoveryPaid"));

const consentUi = readFileSync(
  path.join(process.cwd(), "src/newui-transplant/components/mctb/consent-editor.tsx"),
  "utf8",
);
assert.ok(consentUi.includes("existing_consent") || consentUi.includes("existingConsent"));

console.log("test-mctb-existing-consent-attestation: PASS");
