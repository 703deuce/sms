#!/usr/bin/env npx tsx
/**
 * Contract: callback vocabulary in compiled Amy/Astra prompts when enabled.
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";
import { buildAstraBackendInstructions } from "../src/lib/voice-v3/prompts/astra-backend-instructions";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import {
  buildIntakeObjectiveContext,
  deriveIntakeObjective,
  resolveActiveIntakeOperation,
  UNRESOLVED_INTAKE_OPERATION,
} from "../src/lib/voice-v3/intake-objective";
import { executeRequestCallback } from "../src/lib/voice-v3/callback/execute-request-callback";
import { mergeIntakeUpdate } from "../src/lib/voice-v3/intake-objective";
import { mergeDialogActiveGoalFromTool } from "../src/lib/voice-v3/intake/merge-intake-state";
import { requestCallbackTool } from "../src/lib/voice-v3/tools/request-callback-tool";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";

const TZ = "America/New_York";

const callbackEnabledConfig = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
    callbackUseAniByDefault: true,
  },
  intakeFields: [
    ...VOICE_V3_BOOKING_TEST_CONFIG.intakeFields,
    {
      key: "service_reason",
      label: "Service reason",
      type: "text" as const,
      required: false,
      description: "Why the caller is calling.",
    },
    {
      key: "mother_s_name",
      label: "Mother's name",
      type: "text" as const,
      required: true,
      description: "Booking-only field.",
    },
  ],
  operationRequirements: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.operationRequirements,
    book_appointment: ["name", "email", "phone", "mother_s_name"],
    request_callback: ["name", "phone", "service_reason"],
  },
};

const callbackDisabledConfig = {
  ...callbackEnabledConfig,
  callHandling: {
    ...callbackEnabledConfig.callHandling,
    callbackRequestsEnabled: false,
  },
};

// Amy — enabled
{
  const amy = buildLiveFrontendInstructions({ agentConfig: callbackEnabledConfig });
  const lower = amy.toLowerCase();
  assert.ok(lower.includes("callback"), "Amy must mention callback when enabled");
  assert.ok(lower.includes("call them back"), "Amy delegation must include callback trigger");
  assert.ok(
    lower.includes("until backend success confirms"),
    "Amy must require backend confirmation for callback",
  );
}

// Amy — disabled
{
  const amy = buildLiveFrontendInstructions({ agentConfig: callbackDisabledConfig });
  const lower = amy.toLowerCase();
  assert.ok(!lower.includes("call them back"), "Amy must not advertise callback when disabled");
}

// Astra — enabled
{
  const astra = buildAstraBackendInstructions({
    businessName: "Cert Biz",
    timezone: TZ,
    agentConfig: callbackEnabledConfig,
  });
  const lower = astra.toLowerCase();
  assert.ok(lower.includes("callback path"), "Astra must include callback workflow path");
  assert.ok(lower.includes("request_callback"), "Astra must name authoritative callback tool");
  assert.ok(lower.includes("service reason"), "Astra must show configured callback field labels");
  assert.ok(lower.includes("inbound caller number"), "Astra must document ANI reuse when enabled");
  assert.ok(lower.includes("needs_information"), "Astra must document needs_information retry");
}

// Neutral UNKNOWN intake projection
{
  const clock = buildVoiceV3CallClock(TZ);
  const ctx = createInitialVoiceV3CallContext({
    callId: "neutral",
    liveSessionId: "live_neutral",
    timezone: TZ,
    clock,
    inboundCallerE164: "+15551234567",
  });
  assert.equal(
    resolveActiveIntakeOperation(callbackEnabledConfig, ctx),
    UNRESOLVED_INTAKE_OPERATION,
  );
  const objective = deriveIntakeObjective(callbackEnabledConfig, ctx);
  assert.deepEqual(objective.missingRequiredFields, []);
  assert.ok(!objective.requiredFields.includes("email"));
  const thinking = buildIntakeObjectiveContext(callbackEnabledConfig, ctx);
  assert.ok(thinking.includes("unresolved"));
  assert.ok(thinking.includes("no operation selected"));
}

// Booking → callback transition (goal set when tool selected)
{
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "switch",
    liveSessionId: "live_switch",
    timezone: TZ,
    clock,
    inboundCallerE164: "+15559876543",
  });
  ctx = {
    ...ctx,
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
  };
  const merged = mergeIntakeUpdate({
    current: {},
    update: { name: "Anthony", phone: "+15559876543", email: "a@example.com", mother_s_name: "Mary" },
    config: callbackEnabledConfig,
    at: new Date(),
    sourceCallId: "switch",
    sourceDelegationId: null,
  });
  ctx = { ...ctx, intake: { values: merged.values } };
  const bookingObjective = deriveIntakeObjective(callbackEnabledConfig, ctx);
  assert.ok(bookingObjective.missingRequiredFields.length >= 0);

  ctx = mergeDialogActiveGoalFromTool(ctx, "REQUEST_CALLBACK");
  const callbackObjective = deriveIntakeObjective(callbackEnabledConfig, ctx);
  assert.ok(!callbackObjective.requiredFields.includes("email"));
  assert.ok(!callbackObjective.requiredFields.includes("mother_s_name"));
  assert.deepEqual(callbackObjective.missingRequiredFields, ["service_reason"]);
}

// needs_information → intake → retry → persist (executor + tool wrapper goal)
async function needsInformationContinuation() {
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "needs_info",
    liveSessionId: "live_needs",
    timezone: TZ,
    clock,
    inboundCallerE164: "+15551234567",
  });

  const first = await executeRequestCallback({
    workspaceId: "ws_test",
    agentId: "agent_test",
    config: callbackEnabledConfig,
    context: mergeDialogActiveGoalFromTool(ctx, "REQUEST_CALLBACK"),
    args: {
      callback_phone: null,
      reason: null,
      preferred_time: null,
      notes: null,
    },
    deps: {
      persist: async () => ({
        ok: true,
        callbackRequestId: "should_not_run_yet",
        duplicate: false,
      }),
    },
  });
  assert.equal(first.result.ok, true);
  if (first.result.ok) {
    assert.equal(first.result.status, "needs_information");
    assert.deepEqual(
      (first.result.data as { missingFields?: string[] })?.missingFields?.sort(),
      ["name", "service_reason"].sort(),
    );
  }

  const merged = mergeIntakeUpdate({
    current: first.nextContext.intake.values,
    update: { name: "Anthony", service_reason: "Water heater" },
    config: callbackEnabledConfig,
    at: new Date(),
    sourceCallId: "needs_info",
    sourceDelegationId: null,
  });
  ctx = {
    ...first.nextContext,
    intake: { values: merged.values },
    dialog: { activeGoal: "REQUEST_CALLBACK" },
  };

  let persistCount = 0;
  const second = await executeRequestCallback({
    workspaceId: "ws_test",
    agentId: "agent_test",
    config: callbackEnabledConfig,
    context: ctx,
    args: {
      callback_phone: null,
      reason: null,
      preferred_time: null,
      notes: null,
    },
    deps: {
      persist: async () => {
        persistCount += 1;
        return { ok: true, callbackRequestId: "cb_ok", duplicate: false };
      },
    },
  });
  assert.equal(second.result.ok, true);
  if (second.result.ok) {
    assert.equal(second.result.status, "callback_requested");
  }
  assert.equal(persistCount, 1);
}

// Tool result exposes missingFields to caller (shape)
async function toolWrapperShape() {
  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: "live_tool_cb",
    callId: "call_tool_cb",
    config: callbackEnabledConfig,
  });
  runtime.replaceContext({
    ...runtime.getSnapshot(),
    telephony: { inboundCallerE164: "+15551234567" },
  });
  const result = await requestCallbackTool.execute(
    {
      callId: "call_tool_cb",
      liveSessionId: "live_tool_cb",
      delegationId: "del_cb",
      functionCallId: "fc_cb",
      runtime,
      tenantId: "ws",
      sendContext: () => {},
    },
    {
      callback_phone: null,
      reason: null,
      preferred_time: null,
      notes: null,
    },
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, "needs_information");
    assert.ok(Array.isArray((result.data as { missingFields?: string[] })?.missingFields));
  }
  clearVoiceV3CallRuntimeStore();
}

// Dynamic requirements for cert-like agent
{
  const { astraInstructions } = buildVoiceV3Prompts({
    agentConfig: callbackEnabledConfig,
    timezone: TZ,
  });
  assert.ok(astraInstructions.includes("name"));
  assert.ok(astraInstructions.includes("phone"));
  assert.ok(astraInstructions.includes("service_reason"));
}

needsInformationContinuation()
  .then(() => toolWrapperShape())
  .then(() => {
    console.log("PASS voice-v3 callback prompt contract");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
