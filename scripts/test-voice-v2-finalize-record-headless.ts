/**
 * Finalize vs REQUIRED_FOR_RECORD semantics + ANI phone prefill.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-finalize-record-headless.ts
 */
import assert from "node:assert/strict";
import { transitionAfterBookingConfirmed } from "../src/lib/voice-v2/booking-workflow";
import { executeVoiceV2FinalizeCallerRequest } from "../src/lib/voice-v2/finalize-caller-request";
import { applyCallerAniToIntakeState } from "../src/lib/voice-v2/intake/caller-phone";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { getIntakeReadiness } from "../src/lib/voice-v2/intake/readiness";
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-v2/intake/session-store";
import type { VoiceV2CallContext, VoiceV2IntakeWizardConfig } from "../src/lib/voice-v2/intake/types";

function check(name: string, ok: boolean, detail = "") {
  console.log(ok ? `PASS ${name}` : `FAIL ${name} ${detail}`);
  assert.ok(ok, name);
}

function seedSession(
  wizard: VoiceV2IntakeWizardConfig,
  overrides?: Partial<VoiceV2CallContext>,
  callerFields?: import("@/lib/receptionist-wizard/advanced-types").CallerFieldRow[],
) {
  const schema = intakeSchemaFromWizardOnly(wizard, callerFields);
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:headless-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: overrides?.intakeState ?? {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
    ...overrides,
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function main() {
clearVoiceV2CallSessions();

// A — BOOK succeeded, finalize without name
seedSession({
  fields: {
    email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
    phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
    service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
  },
});
let ctx = getVoiceV2CallContext("cc:headless-test")!;
ctx = applyCallerAniToIntakeState(ctx, "+15551234567");
ctx = transitionAfterBookingConfirmed(ctx);
setVoiceV2CallContext(ctx);
const finA = await executeVoiceV2FinalizeCallerRequest({
  workspaceId: "ws_test",
  agentId: "agent_test",
  callControlId: "headless-test",
  fromE164: "+15551234567",
});
check(
  "A_FINALIZED_AFTER_BOOK",
  finA.status === "FINALIZED" &&
    finA.primary_outcome === "BOOKED" &&
    finA.record_complete === false &&
    finA.missing_for_record.includes("name") &&
    !finA.missing_for_record.includes("phone"),
);

// B — mother_s_name REQUIRED_FOR_RECORD
clearVoiceV2CallSessions();
seedSession(
  {
    fields: {
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  },
  undefined,
  [
    {
      id: "mother_s_name",
      enabled: true,
      required: true,
      label: "Mother's name",
      askWhen: "always",
    },
  ],
);
ctx = transitionAfterBookingConfirmed(getVoiceV2CallContext("cc:headless-test")!);
setVoiceV2CallContext(ctx);
const finB = await executeVoiceV2FinalizeCallerRequest({
  workspaceId: "ws_test",
  agentId: "agent_test",
  callControlId: "headless-test",
});
check(
  "B_CUSTOM_RECORD_FIELD",
  finB.status === "FINALIZED" && finB.missing_for_record.includes("mother_s_name"),
);

// D — ANI on seed
clearVoiceV2CallSessions();
seedSession(
  { fields: { phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" } } },
  {},
);
ctx = applyCallerAniToIntakeState(getVoiceV2CallContext("cc:headless-test")!, "+15559876543");
const readyD = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
check("D_ANI_PHONE_KNOWN", !readyD.missingForRecord.includes("phone"));

// E — callback number save
clearVoiceV2CallSessions();
seedSession({ fields: { phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" } } });
applyCallerAniToIntakeState(getVoiceV2CallContext("cc:headless-test")!, "+15551111111");
await executeVoiceV2SaveIntakeFields(
  { call_id: "headless-test", fields: { phone: "+15552222222" } },
  "ws_test",
  "agent_test",
);
ctx = getVoiceV2CallContext("cc:headless-test")!;
check("E_CALLBACK_NUMBER", ctx.intakeState.phone?.value === "+15552222222");

console.log("\nALL_FINALIZE_RECORD_TESTS_PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
