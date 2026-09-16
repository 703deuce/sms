#!/usr/bin/env npx tsx
/**
 * After-hours handling layer — urgency, transfer, waterfall, callback, spam, fallbacks.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-after-hours-handling-headless.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  afterHoursHandlingFromWizard,
  validateAfterHoursHandlingConfig,
  validateAfterHoursHandlingWizard,
} from "../src/lib/voice-v2/after-hours-handling-config";
import { evaluateUrgencyForContext } from "../src/lib/voice-v2/urgency-evaluator";
import { executeVoiceV2TransferPlan, rejectArbitraryTransferDestination } from "../src/lib/voice-v2/transfer/transfer-executor";
import {
  MockVoiceV2TransferProvider,
  setMockTransferBehavior,
  clearMockTransferBehaviors,
} from "../src/lib/voice-v2/transfer/mock-transfer-provider";
import { executeVoiceV2CreateCallbackRequest } from "../src/lib/voice-v2/callback-request";
import { applyAfterHoursEvaluations } from "../src/lib/voice-v2/after-hours-orchestrator";
import { resolveFallbackHandlingAction } from "../src/lib/voice-v2/fallback-resolver";
import {
  inferCallerClassificationFromTranscriptSnippet,
  blocksCustomerBookingForClassification,
} from "../src/lib/voice-v2/spam-handling";
import { buildWarmTransferBriefing } from "../src/lib/voice-v2/transfer/warm-briefing";
import {
  driveMockVoiceV2WarmTransfer,
  startVoiceV2WarmTransfer,
} from "../src/lib/voice-v2/transfer/warm-transfer-runtime";
import { clearWarmTransferStoreForTests } from "../src/lib/voice-v2/transfer/warm-transfer-store";
import { clearVoiceV2CallSessions, getVoiceV2CallContext, setVoiceV2CallContext } from "../src/lib/voice-v2/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";

function seedCtx(overrides?: Partial<VoiceV2CallContext>): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
      active_flooding: { enabled: true, requirementLevel: "OPTIONAL" },
      water_shutoff_success: { enabled: true, requirementLevel: "OPTIONAL" },
      phone: { enabled: true, requirementLevel: "OPTIONAL" },
      customer_status: { enabled: true, requirementLevel: "OPTIONAL" },
    },
  });
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:after-hours-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/New_York",
    intakeSchema: schema,
    intakeState: {
      phone: {
        value: "+15715551234",
        status: "PREFILLED",
        source: "CALLER_ID",
        updatedAt: new Date().toISOString(),
      },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    ...overrides,
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

function wizardWithTransfer() {
  const w = applyWizardPreset(createDefaultWizardState(), "after_hours");
  w.capabilities = [...new Set([...w.capabilities, "transfer_calls"])];
  w.voiceV2HumanTransferEnabled = true;
  w.transferDestinationPhone = "+15559876543";
  w.transferDestinationName = "On-call";
  w.transferRouting = "waterfall";
  w.transferDestinations = [
    { id: "d1", label: "Primary", phoneE164: "+15551111111", enabled: true },
    { id: "d2", label: "Backup", phoneE164: "+15552222222", enabled: true },
  ];
  w.transferPlanSteps = [
    { order: 1, destinationId: "d1", transferMode: "WARM" },
    { order: 2, destinationId: "d2", transferMode: "BASIC" },
  ];
  w.urgencyEnabled = true;
  w.urgencyRules = [
    {
      id: "urgent_flood",
      fieldKey: "active_flooding",
      operator: "EQUALS",
      value: "true",
      severity: "URGENT",
      action: "TRANSFER",
      transferPlanId: "default_transfer_plan",
    },
  ];
  w.callbackRequestsEnabled = true;
  w.salesSolicitationEnabled = true;
  w.salesSolicitationAction = "TAKE_MESSAGE";
  w.collectFields = [
    ...w.collectFields,
    {
      id: "active_flooding",
      label: "Active flooding",
      required: false,
      enabled: true,
    },
    {
      id: "water_shutoff_success",
      label: "Water shutoff successful",
      required: false,
      enabled: true,
    },
  ];
  return w;
}

async function main() {
  clearVoiceV2CallSessions();
  clearMockTransferBehaviors();
  clearWarmTransferStoreForTests();
  const wizard = wizardWithTransfer();
  const config = afterHoursHandlingFromWizard(wizard);
  assert.equal(validateAfterHoursHandlingConfig(config).length, 0);
  assert.equal(config.transferEnabled, true);
  assert.equal(config.transferPlans[0]?.steps.length, 2);

  const advanced = mergeAppointmentWizardAdvanced(wizard, {});
  assert.ok(advanced.voiceV2AfterHoursHandling);
  assert.equal(validateAfterHoursHandlingWizard(wizard).length, 0);

  // Urgency wizard compile + custom field
  const wCustom = wizardWithTransfer();
  wCustom.collectFields = [
    ...wCustom.collectFields,
    {
      id: "active_water_flow",
      label: "Active water flow",
      required: false,
      enabled: true,
    },
  ];
  wCustom.urgencyRules = [
    {
      id: "u_custom",
      fieldKey: "active_water_flow",
      operator: "EQUALS",
      value: "yes",
      severity: "URGENT",
      action: "TRANSFER",
      transferPlanId: "default_transfer_plan",
    },
  ];
  const customCfg = afterHoursHandlingFromWizard(wCustom);
  assert.equal(customCfg.urgencyRules[0]?.fieldKey, "active_water_flow");
  assert.equal(validateAfterHoursHandlingWizard(wCustom).length, 0);

  const wInvalid = { ...wizardWithTransfer(), urgencyEnabled: true, urgencyRules: [
    {
      id: "bad",
      fieldKey: "deleted_field",
      operator: "EQUALS",
      value: "x",
      severity: "URGENT",
      action: "TRANSFER",
      transferPlanId: "default_transfer_plan",
    },
  ] };
  assert.ok(validateAfterHoursHandlingWizard(wInvalid).some((e) => e.includes("unknown_field")));

  // Urgency
  let ctx = seedCtx({
    capabilities: { afterHoursHandling: config },
    intakeState: {
      active_flooding: {
        value: "true",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
      water_shutoff_success: {
        value: "false",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  ctx = applyAfterHoursEvaluations(ctx, config);
  assert.equal(ctx.afterHours?.urgency?.status, "URGENT");

  ctx = seedCtx({
    capabilities: { afterHoursHandling: config },
    intakeState: {
      active_flooding: {
        value: "false",
        status: "CORRECTED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
    afterHours: { urgency: { status: "URGENT", evaluatedAt: "", stateVersion: 1 } },
  });
  const cleared = evaluateUrgencyForContext(ctx, config);
  assert.equal(cleared.status, "NORMAL");

  // Transfer security
  assert.equal(rejectArbitraryTransferDestination(config, "+19998887777"), true);
  assert.equal(rejectArbitraryTransferDestination(config, "+15551111111"), false);

  // Waterfall mock
  const provider = new MockVoiceV2TransferProvider();
  setMockTransferBehavior("wf1", ["NO_ANSWER", "SUCCESS"]);
  const tctx = seedCtx({ capabilities: { afterHoursHandling: config } });
  const wf = await executeVoiceV2TransferPlan({
    ctx: tctx,
    config,
    provider,
    callControlId: "after-hours-test",
    invocationId: "wf1",
    callerRequested: true,
  });
  assert.equal(wf.ok, true);

  // Warm transfer mock: Press-1 + bridge boundary
  setMockTransferBehavior("warm1", ["INITIATING"]);
  const warmCtx = seedCtx({ capabilities: { afterHoursHandling: config } });
  const warmStart = await executeVoiceV2TransferPlan({
    ctx: warmCtx,
    config: {
      ...config,
      transferPlans: [
        {
          ...config.transferPlans[0]!,
          steps: [{ order: 1, destinationId: "d1", transferMode: "WARM", timeoutSeconds: 20 }],
        },
      ],
    },
    provider,
    callControlId: "after-hours-test",
    invocationId: "warm1",
  });
  assert.equal(warmStart.status, "INITIATING");
  const warmOnly = await startVoiceV2WarmTransfer({
    workspaceId: "ws_test",
    agentId: "agent_test",
    sessionKey: "cc:after-hours-test",
    invocationId: "warm_direct",
    planId: "default_transfer_plan",
    transferGeneration: 9,
    stepOrder: 1,
    destinationId: "d1",
    destinationE164: "+15551111111",
    callerCallControlId: "after-hours-test",
    briefingText: buildWarmTransferBriefing(warmCtx, "On-call"),
    timeoutSeconds: 25,
    mockConsultControlId: "mock_consult_direct",
  });
  assert.equal(warmOnly.result, "INITIATING");
  await driveMockVoiceV2WarmTransfer(warmOnly.sessionId, "consult_answered");
  const press1 = await driveMockVoiceV2WarmTransfer(warmOnly.sessionId, "press_1");
  assert.equal(press1, "SUCCESS");
  const afterBridge = getVoiceV2CallContext("cc:after-hours-test");
  assert.equal(afterBridge?.afterHours?.transfer?.status, "SUCCEEDED");

  // Voicemail / no press-1 → fail
  const vm = await startVoiceV2WarmTransfer({
    workspaceId: "ws_test",
    agentId: "agent_test",
    sessionKey: "cc:after-hours-test",
    invocationId: "warm_vm",
    planId: "default_transfer_plan",
    transferGeneration: 10,
    stepOrder: 1,
    destinationId: "d1",
    destinationE164: "+15551111111",
    callerCallControlId: "after-hours-test",
    briefingText: "Press 1",
    timeoutSeconds: 25,
    mockConsultControlId: "mock_consult_vm",
  });
  const vmResult = await driveMockVoiceV2WarmTransfer(vm.sessionId, "voicemail");
  assert.equal(vmResult, "NO_ANSWER");

  // Late press-1 after new generation ignored (stale)
  const stale = await startVoiceV2WarmTransfer({
    workspaceId: "ws_test",
    agentId: "agent_test",
    sessionKey: "cc:after-hours-test",
    invocationId: "warm_stale",
    planId: "default_transfer_plan",
    transferGeneration: 11,
    stepOrder: 1,
    destinationId: "d1",
    destinationE164: "+15551111111",
    callerCallControlId: "after-hours-test",
    briefingText: "Press 1",
    timeoutSeconds: 25,
    mockConsultControlId: "mock_consult_stale",
  });
  await driveMockVoiceV2WarmTransfer(stale.sessionId, "consult_answered");
  const newer = await startVoiceV2WarmTransfer({
    workspaceId: "ws_test",
    agentId: "agent_test",
    sessionKey: "cc:after-hours-test",
    invocationId: "warm_stale2",
    planId: "default_transfer_plan",
    transferGeneration: 12,
    stepOrder: 2,
    destinationId: "d2",
    destinationE164: "+15552222222",
    callerCallControlId: "after-hours-test",
    briefingText: "Press 1",
    timeoutSeconds: 25,
    mockConsultControlId: "mock_consult_stale2",
  });
  assert.equal(newer.result, "INITIATING");
  const ctxBeforeLate = getVoiceV2CallContext("cc:after-hours-test")!;
  setVoiceV2CallContext({
    ...ctxBeforeLate,
    afterHours: {
      ...ctxBeforeLate.afterHours,
      transfer: {
        status: "INITIATING",
        transferGeneration: 12,
        planId: "default_transfer_plan",
        currentStepOrder: 2,
        invocationId: "warm_stale2",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  await driveMockVoiceV2WarmTransfer(stale.sessionId, "press_1");
  const afterLate = getVoiceV2CallContext("cc:after-hours-test");
  assert.equal(afterLate?.afterHours?.transfer?.transferGeneration, 12);
  assert.notEqual(afterLate?.afterHours?.transfer?.status, "SUCCEEDED");

  // Callback + idempotency
  const cbCtx = seedCtx({ capabilities: { afterHoursHandling: config } });
  const cb1 = await executeVoiceV2CreateCallbackRequest({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "after-hours-test",
    invocationId: "cb1",
    callbackPreference: "tomorrow morning",
    config,
  });
  assert.equal(cb1.status, "CALLBACK_REQUESTED");
  const cb2 = await executeVoiceV2CreateCallbackRequest({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "after-hours-test",
    invocationId: "cb1",
    config,
  });
  assert.equal(cb2.status, "CALLBACK_REQUESTED");

  // Fallback
  const fb = resolveFallbackHandlingAction(config, "waterfall_exhausted", []);
  assert.ok(["CALLBACK", "TAKE_MESSAGE", "CONTINUE"].includes(fb));

  // Spam conservative
  assert.equal(
    inferCallerClassificationFromTranscriptSnippet("I'm asking about the ad I placed with you"),
    "CUSTOMER",
  );
  assert.equal(
    inferCallerClassificationFromTranscriptSnippet("I'm calling to sell you merchant services"),
    "VENDOR_SALES",
  );
  assert.equal(blocksCustomerBookingForClassification(config, "VENDOR_SALES"), true);

  // Warm briefing
  const brief = buildWarmTransferBriefing(
    seedCtx({
      intakeState: {
        name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: "" },
        service_reason: { value: "leak", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
      afterHours: { urgency: { status: "URGENT", evaluatedAt: "", stateVersion: 1 } },
    }),
    "On-call",
  );
  assert.match(brief, /Anthony/);
  assert.match(brief, /Press 1/);

  console.log("test-voice-v2-after-hours-handling-headless: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
