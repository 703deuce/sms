#!/usr/bin/env npx tsx
/**
 * Wizard → Voice V3 backend configuration propagation (no WebRTC / mic).
 */
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertWizardManifestComplete, countWizardManifestCoverage } from "../src/lib/voice-v3/config/wizard-manifest-invariant";
import { runWizardBackendPropagationCert } from "../src/lib/voice-v3/config/wizard-leaf-propagation-verify";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

const OUT_DIR = "/opt/cursor/artifacts/voice-v3-wizard-backend-propagation";

function run(): void {
  assertWizardManifestComplete();
  const leaf = countWizardManifestCoverage();
  assert.equal(leaf.unmapped, 0);

  const report = runWizardBackendPropagationCert({
    buildWizardAgentConfig: (wizard: AppointmentReceptionistWizardState) =>
      buildWizardAgentConfig(wizard) as { advanced?: Record<string, unknown> },
  });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const pass =
    report.mappedCount === report.totalCustomerEditableLeaves &&
    report.compilerPropagatedCount === report.totalCustomerEditableLeaves &&
    report.persistedBackendCount === report.totalCustomerEditableLeaves &&
    report.runtimeConsumedCount === report.totalCustomerEditableLeaves &&
    report.failures.length === 0;

  console.log("VOICE_V3_WIZARD_BACKEND_PROPAGATION", {
    totalCustomerEditableLeaves: report.totalCustomerEditableLeaves,
    mappedCount: report.mappedCount,
    compilerPropagatedCount: report.compilerPropagatedCount,
    persistedBackendCount: report.persistedBackendCount,
    runtimeConsumedCount: report.runtimeConsumedCount,
    failures: report.failures.length,
    step7BrowserLiveTest: report.step7BrowserLiveTest,
    wizardSettingsReachVoiceV3Backend: pass ? "PASS" : "FAIL",
  });

  if (report.failures.length > 0) {
    console.log("FAILURES_SAMPLE", report.failures.slice(0, 25));
  }

  assert.ok(pass, `backend propagation failures: ${report.failures.length}`);
  console.log("VOICE_V3_WIZARD_BACKEND_PROPAGATION: PASS");
}

run();
