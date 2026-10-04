#!/usr/bin/env npx tsx
/**
 * Ensures ensureMctbWorkspaceSeeded never resets canonical mctb.consentMode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/lib/mctb/provisioning/seed-workspace.ts", "utf8");

assert.match(src, /resolveMctbConsentModeForWorkspace/);
assert.match(src, /canonicalConsent/);
assert.doesNotMatch(
  src,
  /consentMode:\s*onboardingSeed\.consentMode\s*\|\|\s*["']press_1["']/,
);
assert.match(src, /consentMode:\s*canonicalConsent/);

const onboardingState = readFileSync("src/lib/mctb/onboarding/state.ts", "utf8");
assert.match(onboardingState, /shouldMirrorConsentToMctb/);
assert.match(onboardingState, /consentStepComplete/);

console.log("test-mctb-seed-workspace-consent: PASS");
