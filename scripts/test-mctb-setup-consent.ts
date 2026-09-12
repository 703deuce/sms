import assert from "node:assert/strict";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
} from "../src/lib/mctb/consent-mode";
import {
  existingConsentIneligibleReason,
  isExistingConsentModeEligible,
} from "../src/lib/mctb/setup-consent-eligibility";
import {
  consentPageHealth,
  consentSnapshotsEqual,
  draftRequiresAttestation,
  draftRequiresPress1Confirm,
  evidenceLabel,
  methodLabel,
  PRESS_1_CALLER_FLOW,
  EXISTING_CONSENT_CALLER_FLOW,
} from "../src/lib/mctb/setup-consent-model";
import { resolveMctbSetupSectionId } from "../src/lib/mctb/setup-sections";

assert.equal(resolveMctbSetupSectionId("/mctb/setup/consent"), "consent");

assert.equal(isExistingConsentModeEligible({ messagingReady: true }), true);
assert.equal(isExistingConsentModeEligible({ messagingReady: false }), false);
assert.ok(existingConsentIneligibleReason(false)?.includes("messaging"));

assert.equal(methodLabel(MCTB_CONSENT_MODE_VERIFIED), "Press 1");
assert.equal(methodLabel(MCTB_CONSENT_MODE_EXISTING), "Existing consent");
assert.equal(evidenceLabel(MCTB_CONSENT_MODE_VERIFIED), "Per-call consent");

assert.equal(
  consentPageHealth({
    mode: MCTB_CONSENT_MODE_EXISTING,
    existingConsentEligible: false,
  }),
  "needs_attention",
);
assert.equal(
  consentPageHealth({
    mode: MCTB_CONSENT_MODE_VERIFIED,
    existingConsentEligible: false,
  }),
  "configured",
);

const snapA = { mode: MCTB_CONSENT_MODE_VERIFIED };
const snapB = { mode: MCTB_CONSENT_MODE_VERIFIED };
assert.equal(consentSnapshotsEqual(snapA, snapB), true);
assert.equal(
  consentSnapshotsEqual(snapA, { mode: MCTB_CONSENT_MODE_EXISTING }),
  false,
);

assert.equal(
  draftRequiresAttestation(MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_VERIFIED),
  true,
);
assert.equal(
  draftRequiresPress1Confirm(MCTB_CONSENT_MODE_VERIFIED, MCTB_CONSENT_MODE_EXISTING),
  true,
);

assert.ok(PRESS_1_CALLER_FLOW.some((s) => s.id === "press1"));
assert.ok(!EXISTING_CONSENT_CALLER_FLOW.some((s) => s.id === "press1"));

console.log("test-mctb-setup-consent: ok");
