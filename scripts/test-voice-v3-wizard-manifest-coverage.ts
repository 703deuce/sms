#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  assertWizardManifestComplete,
  countWizardManifestCoverage,
} from "../src/lib/voice-v3/config/wizard-manifest-invariant";
import {
  WIZARD_V3_FIELD_MANIFEST,
  WIZARD_V3_MANIFEST_SUMMARY,
} from "../src/lib/voice-v3/config/wizard-v3-field-manifest";

function run(): void {
  assertWizardManifestComplete();
  const leaf = countWizardManifestCoverage();
  assert.equal(leaf.unmapped, 0);
  assert.ok(WIZARD_V3_FIELD_MANIFEST.length >= 100, "manifest should be exhaustive");
  assert.equal(WIZARD_V3_MANIFEST_SUMMARY.unmapped, 0);
  console.log("VOICE_V3_WIZARD_LEAF_COVERAGE", leaf);
  console.log("VOICE_V3_WIZARD_MANIFEST_COVERAGE", WIZARD_V3_MANIFEST_SUMMARY);
  console.log("VOICE_V3_WIZARD_MANIFEST_COVERAGE: PASS");
}

run();
