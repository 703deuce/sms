import assert from "node:assert/strict";
import { ODD_INTAKE_HARNESS_AGENT_CONFIG } from "./fixtures/voice-v3-odd-intake-harness-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import {
  buildToolIntakeProjection,
  deriveIntakeObjective,
  mergeIntakeUpdate,
} from "../src/lib/voice-v3/intake-objective";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { updateIntakeTool } from "../src/lib/voice-v3/tools/update-intake-tool";

const config = ODD_INTAKE_HARNESS_AGENT_CONFIG;

function emptyCtx() {
  const clock = buildVoiceV3CallClock(config.timezone);
  return createInitialVoiceV3CallContext({
    callId: "call_obj",
    liveSessionId: "live_obj",
    clock,
  });
}

function objective(ctx: ReturnType<typeof emptyCtx>) {
  return deriveIntakeObjective(config, ctx);
}

// Derivation: neutral UNKNOWN — no operation-specific requirements yet
{
  const o = objective(emptyCtx());
  assert.equal(o.status, "NOT_STARTED");
  assert.deepEqual(o.missingRequiredFields, []);
}

// Booking operation when goal is explicit
{
  const ctx = {
    ...emptyCtx(),
    dialog: { activeGoal: "BOOK_APPOINTMENT" as const },
  };
  const o = objective(ctx);
  assert.equal(o.status, "NOT_STARTED");
  assert.deepEqual(o.missingRequiredFields.sort(), ["email", "mothers_name", "name"].sort());
}

// One required -> IN_PROGRESS
{
  const merged = mergeIntakeUpdate({
    current: {},
    update: { name: "Anthony Johnson" },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  const ctx = {
    ...emptyCtx(),
    intake: { values: merged.values },
    dialog: { activeGoal: "BOOK_APPOINTMENT" as const },
  };
  const o = objective(ctx);
  assert.equal(o.status, "IN_PROGRESS");
  assert.ok(o.collectedFields.includes("name"));
}

// All required -> COMPLETE (optional missing)
{
  const merged = mergeIntakeUpdate({
    current: {},
    update: {
      name: "Anthony Johnson",
      email: "anthony@example.com",
      mothers_name: "Mary",
    },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  const ctx = {
    ...emptyCtx(),
    intake: { values: merged.values },
    dialog: { activeGoal: "BOOK_APPOINTMENT" as const },
  };
  assert.equal(objective(ctx).status, "COMPLETE");
}

// Multi-field one call
{
  const merged = mergeIntakeUpdate({
    current: {},
    update: {
      name: "Anthony Johnson",
      email: "anthony@example.com",
      service_reason: "Shower leaking",
    },
    config: {
      ...config,
      intakeFields: [
        ...config.intakeFields,
        {
          key: "service_reason",
          label: "Service reason",
          type: "text",
          required: false,
          description: "Reason for service.",
        },
      ],
    },
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  assert.equal(merged.updatedFields.length, 3);
}

// Partial success: 2 valid, 1 invalid email
{
  const merged = mergeIntakeUpdate({
    current: {},
    update: {
      name: "Anthony",
      mothers_name: "Mary",
      email: "not-an-email",
    },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  assert.ok(merged.updatedFields.includes("name"));
  assert.ok(merged.updatedFields.includes("mothers_name"));
  assert.equal(merged.rejectedFields.length, 1);
  assert.equal(merged.rejectedFields[0].field, "email");
}

// Null does not erase existing
{
  const first = mergeIntakeUpdate({
    current: {},
    update: { name: "Alice" },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  const second = mergeIntakeUpdate({
    current: first.values,
    update: { name: null, email: null },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  assert.equal(second.values.name?.value, "Alice");
}

// Correction wins
{
  const first = mergeIntakeUpdate({
    current: {},
    update: { email: "anthony@gmail.com" },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  const second = mergeIntakeUpdate({
    current: first.values,
    update: { email: "anthonyj@gmail.com" },
    config,
    at: new Date(),
    sourceCallId: "c",
    sourceDelegationId: null,
  });
  assert.equal(second.values.email?.value, "anthonyj@gmail.com");
  assert.ok((second.values.email?.revision ?? 0) >= 1);
}

async function toolIntegration() {
  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: "live_tool",
    callId: "call_tool",
    config,
  });
  const sent: Array<{ type: string }> = [];
  const ctx = {
    callId: "call_tool",
    liveSessionId: "live_tool",
    delegationId: "del_1",
    functionCallId: "fc_1",
    runtime,
    tenantId: "call_tool",
    sendContext: (e: { type: string }) => {
      sent.push(e);
    },
  };

  runtime.replaceContext({
    ...runtime.getSnapshot(),
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
  });

  const result = await updateIntakeTool.execute(ctx, {
    name: "Anthony Johnson",
    email: "anthony@example.com",
    mothers_name: "Mary",
    favorite_dinosaur: null,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.data?.updated_fields?.includes("name"));
    assert.equal(result.data?.objective?.status, "COMPLETE");
  }
  assert.ok(sent.some((e) => e.type === "session.thinking.append"));
  clearVoiceV3CallRuntimeStore();
}

// Tool result projection: book requirements even when active operation is unresolved
{
  const ctx = emptyCtx();
  const p = buildToolIntakeProjection(config, ctx);
  assert.equal(p.active_operation, "unresolved");
  assert.deepEqual(p.missing_required_fields, []);
  assert.equal(p.book_appointment.ready, false);
  assert.ok(p.book_appointment.missing_fields.includes("email"));
}

toolIntegration()
  .then(() => {
    console.log("PASS voice-v3 intake objective");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
