#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { resolveWizardSnapshotForVoiceV3 } from "../src/lib/voice-v3/config/resolve-wizard-snapshot-for-v3";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

function wizardConfig(wizard: ReturnType<typeof createDefaultWizardState>): VoiceAgentConfig {
  return {
    name: "Test",
    advanced: {
      capabilityPack: "appointment_receptionist",
      appointmentReceptionistWizard: wizard,
    },
  } as VoiceAgentConfig;
}

function run(): void {
  const publishedWizard = createDefaultWizardState();
  publishedWizard.agentName = "Amy";
  publishedWizard.collectFields = [
    { id: "full_name", label: "Name", required: true, enabled: true },
  ];
  publishedWizard.appointmentTypes[0].durationMin = 60;

  const draftWizard = createDefaultWizardState();
  draftWizard.agentName = "Jessica";
  draftWizard.collectFields = [
    { id: "full_name", label: "Name", required: true, enabled: true },
    { id: "custom_project_type", label: "Project type", required: true, enabled: true },
  ];
  draftWizard.appointmentTypes[0].durationMin = 30;

  const publishedCfg = wizardConfig(publishedWizard);
  const draftCfg = wizardConfig(draftWizard);

  const testPick = resolveWizardSnapshotForVoiceV3({
    agentStatus: "TESTING",
    draftConfig: draftCfg,
    publishedRuntimeConfig: publishedCfg,
  });
  assert.equal(testPick.source, "wizard_draft_test");
  assert.equal(testPick.wizard?.agentName, "Jessica");

  const prodPick = resolveWizardSnapshotForVoiceV3({
    agentStatus: "ACTIVE",
    draftConfig: draftCfg,
    publishedRuntimeConfig: publishedCfg,
  });
  assert.equal(prodPick.source, "wizard_published");
  assert.equal(prodPick.wizard?.agentName, "Amy");

  const testCompiled = compileVoiceV3AgentConfig({
    wizard: testPick.wizard!,
    source: testPick.source,
  });
  const prodCompiled = compileVoiceV3AgentConfig({
    wizard: prodPick.wizard!,
    source: prodPick.source,
  });

  assert.equal(testCompiled.identity.agentName, "Jessica");
  assert.equal(prodCompiled.identity.agentName, "Amy");
  assert.ok(testCompiled.intakeFields.some((f) => f.key === "project_type" && f.required));
  assert.ok(!prodCompiled.intakeFields.some((f) => f.key === "project_type"));
  assert.equal(testCompiled.service.durationMinutes, 30);
  assert.equal(prodCompiled.service.durationMinutes, 60);

  console.log("VOICE_V3_WIZARD_DRAFT_VS_PUBLISHED_RESOLUTION: PASS");
}

run();
