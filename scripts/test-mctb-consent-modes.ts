/**
 * Consent mode runtime checks.
 * Run: npx tsx scripts/test-mctb-consent-modes.ts
 */
import assert from "node:assert/strict";
import {
  isExistingConsentMode,
  isVerifiedCallConsentMode,
  normalizeMctbConsentMode,
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
  EXISTING_CONSENT_METHOD,
} from "@/lib/mctb/consent-mode";

assert.equal(normalizeMctbConsentMode("existing_consent"), MCTB_CONSENT_MODE_EXISTING);
assert.equal(normalizeMctbConsentMode("press_1"), MCTB_CONSENT_MODE_VERIFIED);
assert.equal(normalizeMctbConsentMode(undefined), MCTB_CONSENT_MODE_VERIFIED);
assert.ok(isExistingConsentMode(MCTB_CONSENT_MODE_EXISTING));
assert.ok(isVerifiedCallConsentMode(MCTB_CONSENT_MODE_VERIFIED));
assert.equal(EXISTING_CONSENT_METHOD, "EXISTING_CONSENT");

console.log("✓ consent mode helpers");
