#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { GPT_LIVE_WIZARD_AUDIT_TABLE } from "../src/lib/voice-v3/config/gpt-live-wizard-audit";
import { findUnmappedCustomerEditableControlPaths } from "../src/lib/voice-v3/config/wizard-manifest-invariant";
import { countWizardManifestCoverage } from "../src/lib/voice-v3/config/wizard-manifest-invariant";
import { WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS } from "../src/lib/voice-v3/config/wizard-control-inventory";

function run(): void {
  assert.ok(GPT_LIVE_WIZARD_AUDIT_TABLE.length >= 10);
  const legacyRemoved = GPT_LIVE_WIZARD_AUDIT_TABLE.filter(
    (r) => r.action === "REMOVE" && r.category === "UNSUPPORTED_LEGACY",
  );
  assert.ok(legacyRemoved.length >= 2);

  const inventoryLegacy = WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.filter((p) =>
    ["responsiveness", "interruptionSensitivity", "speakingSpeed"].includes(p),
  );
  assert.equal(inventoryLegacy.length, 0, "legacy VAD/TTS sliders must not be customer-editable");

  const unmapped = findUnmappedCustomerEditableControlPaths();
  assert.equal(unmapped.length, 0, unmapped.join(", "));

  const coverage = countWizardManifestCoverage();
  console.log("VOICE_V3_GPT_LIVE_WIZARD_AUDIT", {
    auditRows: GPT_LIVE_WIZARD_AUDIT_TABLE.length,
    customerEditableLeaves: coverage.totalEditableLeafControls,
    mappedLeaves: coverage.totalV3MappedLeafControls,
  });
  console.log("VOICE_V3_GPT_LIVE_WIZARD_AUDIT: PASS");
}

run();
