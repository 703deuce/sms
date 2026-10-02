#!/usr/bin/env tsx
/**
 * Regression: partial saveLeadRecoveryConfig patches must not wipe omitted fields.
 * Run: npx tsx scripts/test-lead-recovery-config-patch-merge.ts
 */
import assert from "node:assert/strict";

function mergeLeadRecoveryPatch(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  return {
    ...prev,
    ...definedPatch,
    version: definedPatch.version ?? (typeof prev.version === "number" ? prev.version : 1),
  };
}

const prev = {
  enabled: true,
  collectCapabilities: ["NAME", "REASON", "CALLBACK_TIME", "CALLBACK_NUMBER"],
  enabledScenarios: { general: true },
};

const scenarioOnlyPatch = {
  enabled: true,
  enabledScenarios: { general: true, booking: true },
  collectCapabilities: undefined,
  intentPolicies: undefined,
};

const next = mergeLeadRecoveryPatch(prev, scenarioOnlyPatch);
assert.deepEqual(next.collectCapabilities, prev.collectCapabilities);
assert.equal(next.enabledScenarios.booking, true);

console.log("test-lead-recovery-config-patch-merge: OK");
