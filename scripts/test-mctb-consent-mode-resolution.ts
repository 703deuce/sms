#!/usr/bin/env npx tsx
/**
 * Consent mode must not revert to Press 1 when canonical mctb.consentMode is unset
 * but solution setup or attestation still says existing consent.
 */
import assert from "node:assert/strict";
import { resolveMctbConsentModeFromCustomFields } from "@/lib/mctb/consent-mode-resolution-core";

const attestedCfg = {
  mctb: {
    existingConsentAttestation: {
      accepted: true,
      version: "1",
      attestedByUserId: "user_1",
      attestedAt: "2026-10-01T00:00:00.000Z",
    },
  },
  mctbOnboarding: { version: 2, consentMode: "press_1" },
};

const fromAttestation = resolveMctbConsentModeFromCustomFields({
  customFieldsConfig: attestedCfg,
});
assert.equal(fromAttestation.mode, "existing_consent");
assert.equal(fromAttestation.source, "existing_attestation");

const fromSolution = resolveMctbConsentModeFromCustomFields({
  customFieldsConfig: { mctb: {} },
  solutionConsentMode: "existing_consent",
});
assert.equal(fromSolution.mode, "existing_consent");
assert.equal(fromSolution.source, "solution_setup");

const canonicalWins = resolveMctbConsentModeFromCustomFields({
  customFieldsConfig: { mctb: { consentMode: "press_1" } },
  solutionConsentMode: "existing_consent",
});
assert.equal(canonicalWins.mode, "press_1");
assert.equal(canonicalWins.source, "canonical_mctb");

console.log("test-mctb-consent-mode-resolution: PASS");
