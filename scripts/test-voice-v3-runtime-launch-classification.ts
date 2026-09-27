#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { WIZARD_V3_MANIFEST_SUMMARY } from "../src/lib/voice-v3/config/wizard-v3-field-manifest";
import { classifyWizardRuntimeLeaf } from "../src/lib/voice-v3/config/wizard-v3-runtime-launch-classification";

assert.equal(
  classifyWizardRuntimeLeaf("bookingLinkUrl").classification,
  "CURRENT_VISIBLE_IMPLEMENTED",
);
assert.equal(
  classifyWizardRuntimeLeaf("bookingLinkLabel").classification,
  "CURRENT_VISIBLE_IMPLEMENTED",
);
assert.equal(
  classifyWizardRuntimeLeaf("calendlyEventTypeUri").classification,
  "OUT_OF_SCOPE_RETIRED",
);

// After launch remapping, exposed gaps should be a small set (not ~99).
assert.ok(
  WIZARD_V3_MANIFEST_SUMMARY.CONFIGURED_NOT_IMPLEMENTED <= 10,
  `expected <=10 CONFIGURED_NOT_IMPLEMENTED, got ${WIZARD_V3_MANIFEST_SUMMARY.CONFIGURED_NOT_IMPLEMENTED}`,
);
assert.ok(
  WIZARD_V3_MANIFEST_SUMMARY.ACTIVE_EXECUTION >= 150,
  `expected ACTIVE_EXECUTION to reflect implemented runtime, got ${WIZARD_V3_MANIFEST_SUMMARY.ACTIVE_EXECUTION}`,
);

console.log("VOICE_V3_RUNTIME_LAUNCH_CLASSIFICATION=PASS");
console.log(JSON.stringify(WIZARD_V3_MANIFEST_SUMMARY, null, 2));
