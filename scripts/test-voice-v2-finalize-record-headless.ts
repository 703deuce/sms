/**
 * Finalize vs REQUIRED_FOR_RECORD semantics + ANI / callback separation.
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
import {
  resolveVoiceV2PrimaryOutcome,
  type VoiceV2PrimaryOutcome,
} from "../src/lib/voice-v2/primary-outcome";

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

const recordWizard: VoiceV2IntakeWizardConfig = {
  fields: {
    name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
    phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
  },
};

async function expectFinalizedWithMissingRecord(
  label: string,
  expectedOutcome: VoiceV2PrimaryOutcome,
  ctxPatch: Partial<VoiceV2CallContext>,
) {
  clearVoiceV2CallSessions();
  seedSession(recordWizard, ctxPatch);
  const fin = await executeVoiceV2FinalizeCallerRequest({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  check(
    label,
    fin.status === "FINALIZED" &&
      fin.primary_outcome === expectedOutcome &&
      fin.record_complete === false &&
      fin.missing_for_record.includes("name"),
  );
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

  // C — other successful primary outcomes + missing record field
  await expectFinalizedWithMissingRecord("C_TRANSFERRED_SUCCEEDED", "TRANSFERRED", {
    afterHours: {
      transfer: {
        status: "SUCCEEDED",
        transferGeneration: 1,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  clearVoiceV2CallSessions();
  seedSession(recordWizard, {
    afterHours: {
      transfer: {
        status: "INITIATING",
        transferGeneration: 1,
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const initiatingCtx = getVoiceV2CallContext("cc:headless-test")!;
  check(
    "C_TRANSFER_INITIATING_NOT_PRIMARY",
    resolveVoiceV2PrimaryOutcome(initiatingCtx) !== "TRANSFERRED",
  );
  const finInitiating = await executeVoiceV2FinalizeCallerRequest({
    workspaceId: "ws_test",
    agentId: "agent_test",
    callControlId: "headless-test",
  });
  check(
    "C_TRANSFER_INITIATING_FINALIZE_NOT_TRANSFERRED",
    !(finInitiating.status === "FINALIZED" && finInitiating.primary_outcome === "TRANSFERRED"),
  );

  await expectFinalizedWithMissingRecord("C_CALLBACK_REQUESTED", "CALLBACK_REQUESTED", {
    afterHours: {
      callback: { requested: true, callbackNumber: "+15553334444" },
    },
  });

  await expectFinalizedWithMissingRecord("C_BOOKING_LINK_SENT", "BOOKING_LINK_SENT", {
    bookingWorkflow: {
      bookingIntentActive: true,
      callbackRequested: false,
      bookingCancelled: false,
      bookingConfirmed: false,
      callerRequestFinalized: false,
      bookingLinkSent: true,
      requestedDate: null,
      lastFindRequestedDate: null,
      nextStage: "COMPLETE",
    },
  });

  await expectFinalizedWithMissingRecord("C_RESCHEDULED", "RESCHEDULED", {
    appointmentAction: {
      intent: "RESCHEDULE",
      refsById: {},
      status: "RESCHEDULE_CONFIRMED",
    },
  });

  await expectFinalizedWithMissingRecord("C_CANCELED", "CANCELED", {
    appointmentAction: {
      intent: "CANCEL",
      refsById: {},
      status: "CANCEL_CONFIRMED",
    },
  });

  // D — ANI on seed
  clearVoiceV2CallSessions();
  seedSession({ fields: { phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" } } }, {});
  ctx = applyCallerAniToIntakeState(getVoiceV2CallContext("cc:headless-test")!, "+15559876543");
  const readyD = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  check("D_ANI_PHONE_KNOWN", !readyD.missingForRecord.includes("phone"));
  check("D_CALLER_ANI_STORED", ctx.callerAniE164 === "+15559876543");

  // E — callback number save (ANI preserved on phone)
  clearVoiceV2CallSessions();
  seedSession(
    { fields: { phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" } } },
    {},
    [
      {
        id: "callback_number",
        enabled: true,
        required: false,
        label: "Callback number",
        askWhen: "always",
      },
    ],
  );
  ctx = applyCallerAniToIntakeState(getVoiceV2CallContext("cc:headless-test")!, "+15551111111");
  setVoiceV2CallContext(ctx);
  await executeVoiceV2SaveIntakeFields(
    { call_id: "headless-test", fields: { phone: "+15552222222" } },
    "ws_test",
    "agent_test",
  );
  ctx = getVoiceV2CallContext("cc:headless-test")!;
  check("E_ANI_PHONE_KEPT", ctx.intakeState.phone?.value === "+15551111111");
  check("E_CALLBACK_NUMBER", ctx.intakeState.callback_number?.value === "+15552222222");
  check("E_CALLER_ANI_UNCHANGED", ctx.callerAniE164 === "+15551111111");

  console.log("\nALL_FINALIZE_RECORD_TESTS_PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
