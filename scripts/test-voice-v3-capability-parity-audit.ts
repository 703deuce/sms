#!/usr/bin/env npx tsx
/**
 * Cert vs wizard capability parity (compiled tools + prompt alignment).
 */
import assert from "node:assert/strict";
import {
  assertWizardM365MatchesCertCalendarTools,
  compileScenario,
  toolMatrixForConfigs,
  VOICE_V3_PARITY_TOOL_ORDER,
} from "../src/lib/voice-v3/config/capability-parity-audit";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";

function main(): void {
  const cert = compileScenario("cert_m365_reference");
  const wizardM365 = compileScenario("wizard_microsoft_365_direct");
  const wizardDefault = compileScenario("wizard_default_request_only");

  assertWizardM365MatchesCertCalendarTools();

  const certTools = listVoiceV3AstraToolNamesForConfig(cert).sort();
  const m365Tools = listVoiceV3AstraToolNamesForConfig(wizardM365).sort();
  for (const name of [
    "set_scheduling_preference",
    "find_availability",
    "book_appointment",
  ]) {
    assert.ok(certTools.includes(name), `cert missing ${name}`);
    assert.ok(m365Tools.includes(name), `wizard M365 missing ${name}`);
  }

  const defaultTools = listVoiceV3AstraToolNamesForConfig(wizardDefault);
  assert.ok(defaultTools.includes("submit_appointment_request"));
  assert.ok(!defaultTools.includes("book_appointment"));
  assert.ok(!defaultTools.includes("find_availability"));

  assert.ok(
    wizardM365.transfer?.enabled === true,
    "M365 fixture should enable transfer policy when destination configured",
  );
  assert.ok(
    m365Tools.includes("transfer_call"),
    "transfer_call should register when transfer policy + destination configured",
  );

  const defaultPrompts = buildVoiceV3Prompts({
    agentConfig: wizardDefault,
    toolNames: defaultTools,
  });
  assert.ok(
    !defaultPrompts.astraInstructions.includes("New booking path (typical order)"),
    "REQUEST_ONLY astra should not include direct calendar booking workflow",
  );
  assert.ok(
    defaultPrompts.astraInstructions.includes("Request-only booking mode"),
    "REQUEST_ONLY astra should include request-only append",
  );
  assert.ok(
    !defaultPrompts.liveInstructions.includes("Transferring to a human"),
    "Amy should not advertise transfer without transfer_call tool",
  );

  const m365Prompts = buildVoiceV3Prompts({
    agentConfig: wizardM365,
    toolNames: m365Tools,
  });
  assert.ok(m365Prompts.liveInstructions.includes("Transferring to a human"));
  assert.ok(m365Prompts.astraInstructions.includes("New booking path"));

  const matrix = toolMatrixForConfigs(cert, wizardDefault);
  assert.equal(matrix.length, VOICE_V3_PARITY_TOOL_ORDER.length);

  console.log("VOICE_V3_CAPABILITY_PARITY_AUDIT: PASS");
}

main();
