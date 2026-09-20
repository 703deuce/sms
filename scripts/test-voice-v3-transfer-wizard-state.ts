#!/usr/bin/env npx tsx
/**
 * Emergency transfer wizard state helpers + compiler parity (no browser).
 */
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { buildAstraTransferInstructions } from "../src/lib/voice-v3/prompts/astra-transfer-instructions";
import {
  addTransferDestination,
  ensureEmergencyTransferWizardState,
  moveTransferPlanStep,
  removeTransferDestination,
  syncLegacyTransferFieldsFromDestinations,
  transferWizardValidationIssues,
  updateTransferPlanStep,
} from "../src/lib/solutions/appointment-receptionist/transfer-wizard-state";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

function base(): AppointmentReceptionistWizardState {
  return {
    capabilities: ["transfer_calls", "answer_questions"],
    transferDestinationName: "Legacy Desk",
    transferDestinationPhone: "+15551112222",
    transferRingSeconds: 20,
    transferFallback: "return_to_ai",
    warmTransfer: false,
    voiceV2HumanTransferEnabled: true,
    transferTriggers: ["Emergency"],
    transferRouting: "waterfall",
  } as AppointmentReceptionistWizardState;
}

function run(): void {
  const legacy = base();
  const migrated = ensureEmergencyTransferWizardState(legacy);
  assert.equal(migrated.transferDestinations?.length, 1);
  assert.equal(migrated.transferDestinations?.[0]?.phoneE164, "+15551112222");

  let state = ensureEmergencyTransferWizardState(legacy);
  state = {
    ...state,
    ...addTransferDestination(state, { label: "Manager", phoneE164: "+15553334444" }),
  } as AppointmentReceptionistWizardState;
  state = {
    ...state,
    ...addTransferDestination(state, { label: "Owner", phoneE164: "+15555556666" }),
  } as AppointmentReceptionistWizardState;

  const ownerId = state.transferDestinations!.find((d) => d.label === "Owner")!.id;
  state = {
    ...state,
    ...updateTransferPlanStep(state, ownerId, { transferMode: "WARM", timeoutSeconds: 30 }),
  } as AppointmentReceptionistWizardState;

  const managerId = state.transferDestinations!.find((d) => d.label === "Manager")!.id;
  const beforeOrder = [...(state.transferPlanSteps ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  ).map((s) => s.destinationId);
  state = {
    ...state,
    ...moveTransferPlanStep(state, ownerId, "up"),
  } as AppointmentReceptionistWizardState;

  const afterOrder = [...(state.transferPlanSteps ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  ).map((s) => s.destinationId);
  assert.notDeepEqual(beforeOrder, afterOrder);
  assert.equal(afterOrder.indexOf(ownerId), afterOrder.indexOf(managerId) - 1);

  state = {
    ...state,
    ...removeTransferDestination(state, managerId),
  } as AppointmentReceptionistWizardState;
  assert.ok(!state.transferPlanSteps?.some((s) => s.destinationId === managerId));

  const issues = transferWizardValidationIssues(state);
  assert.ok(issues.length === 0 || issues.every((i) => i.id !== "transfer_ui_orphan_step"));

  const synced = syncLegacyTransferFieldsFromDestinations(state);
  assert.ok(synced.transferDestinationPhone);

  const config = compileVoiceV3AgentConfig({ wizard: { ...state, ...synced } });
  assert.equal(config.transfer?.enabled, true);
  assert.equal(config.transfer?.routing, "waterfall");
  assert.ok(config.transfer!.routes[0]!.targets.length >= 2);

  const astra = buildAstraTransferInstructions(config);
  assert.match(astra, /destination_id=/);
  assert.ok(!astra.includes("+1555"));

  console.log("VOICE_V3_TRANSFER_WIZARD_STATE_CERT: PASS");
}

run();
