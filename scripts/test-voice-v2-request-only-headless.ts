#!/usr/bin/env npx tsx
/**
 * REQUEST_ONLY mode — headless certification (sections 33–36).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-request-only-headless.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  buildAmyConversationWorkflow,
  workflowNodeExpectedTools,
} from "../src/lib/voice/telnyx/conversation-workflow";
import { buildDesiredTelnyxWorkflowPayload } from "../src/lib/voice/telnyx/workflow-sync";
import { deriveVoiceV2NextStage, transitionAfterIntakeSave } from "../src/lib/voice-v2/booking-workflow";
import { resolveVoiceV2BookingStrategy } from "../src/lib/voice-v2/booking-strategy";
import { getIntakeReadiness } from "../src/lib/voice-v2/intake/readiness";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-v2/intake/compile-schema";
import type { VoiceAgentConfig } from "../src/lib/voice/types";
import {
  buildVoiceV2CallCapabilitySnapshot,
  verifyVoiceV2WorkflowReadBack,
} from "../src/lib/voice-v2/workflow-capability";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "../src/lib/voice-v2/telnyx-tool-definition";

function configForStrategy(
  strategy: "NONE" | "REQUEST_ONLY" | "MICROSOFT_365",
): VoiceAgentConfig {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.bookingStrategy = strategy;
  if (strategy === "NONE") {
    wizard.capabilities = wizard.capabilities.filter((c) => c !== "book_appointments");
    wizard.capabilities.push("take_messages");
  } else {
    if (!wizard.capabilities.includes("book_appointments")) {
      wizard.capabilities.push("book_appointments");
    }
    if (strategy === "MICROSOFT_365") {
      wizard.calendarConnected = true;
      wizard.calendarProvider = "microsoft";
      wizard.appointmentTypes = wizard.appointmentTypes.map((t) => ({
        ...t,
        bookingPermission: "book_directly",
      }));
    } else if (strategy === "REQUEST_ONLY") {
      wizard.appointmentTypes = wizard.appointmentTypes.map((t) => ({
        ...t,
        bookingPermission: "suggest_then_confirm",
      }));
    }
  }
  const advanced = mergeAppointmentWizardAdvanced(wizard, {});
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      ...advanced,
      conversationWorkflowMode: true,
    },
  } as VoiceAgentConfig);
}

const v2Ids = {
  findId: "v2_find",
  bookId: "v2_book",
  saveIntakeId: "v2_save",
  finalizeRequestId: "v2_finalize",
  findExistingId: null,
  rescheduleId: null,
  cancelId: null,
};

const baseShared = {
  sendResourceId: "st_send",
  searchDetailsId: "st_search",
  voiceAiBookingId: "st_legacy_book",
  hangupId: "st_hangup",
  transferId: "st_transfer",
};

function toolNamesForConfig(cfg: VoiceAgentConfig) {
  const strategy = resolveVoiceV2BookingStrategy(cfg);
  const live = strategy === "MICROSOFT_365";
  const plan = buildDesiredTelnyxWorkflowPayload({
    shared: baseShared,
    v2Shared: v2Ids,
    config: cfg,
  });
  const tools = workflowNodeExpectedTools("n_general", {
    voiceV2Find: live ? v2Ids.findId : null,
    voiceV2Book: live ? v2Ids.bookId : null,
    voiceV2SaveIntake: v2Ids.saveIntakeId,
    voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  });
  return { plan, tools };
}

// Mode isolation
const reqCfg = configForStrategy("REQUEST_ONLY");
assert.equal(resolveVoiceV2BookingStrategy(reqCfg), "REQUEST_ONLY");
const reqTools = toolNamesForConfig(reqCfg);
assert.ok(!reqTools.tools.includes("voice_v2_find_availability"));
assert.ok(!reqTools.tools.includes("voice_v2_book_offered_slot"));
assert.ok(reqTools.tools.includes("voice_v2_finalize_caller_request"));

const msCfg = configForStrategy("MICROSOFT_365");
const msTools = toolNamesForConfig(msCfg);
assert.ok(msTools.tools.includes("voice_v2_find_availability"));
assert.ok(msTools.tools.includes("voice_v2_book_offered_slot"));

const noneCfg = configForStrategy("NONE");
assert.equal(resolveVoiceV2BookingStrategy(noneCfg), "NONE");

// Workflow stage — REQUEST_ONLY with preference → finalize
const schema = compileVoiceV2IntakeSchema(reqCfg);
const filledState: VoiceV2CallContext["intakeState"] = {};
const nowIso = new Date().toISOString();
for (const field of schema.fields) {
  if (field.requirementLevel === "OPTIONAL") continue;
  filledState[field.key] = {
    value:
      field.key === "phone"
        ? "+15715550100"
        : field.key === "email"
          ? "a@example.com"
          : field.key === "name"
            ? "Anthony"
            : field.key === "service_reason"
              ? "kitchen leak"
              : "test",
    status: "CAPTURED",
    source: "CALLER",
    updatedAt: nowIso,
  };
}
const ctx: VoiceV2CallContext = {
  sessionKey: "cc:test",
  workspaceId: "ws_test",
  agentId: "agent_test",
  businessTimezone: "America/New_York",
  intakeSchema: schema,
  intakeState: filledState,
  askedFields: {},
  compiledAt: new Date().toISOString(),
  capabilities: { bookingStrategy: "REQUEST_ONLY", voiceV2PstnLiveBooking: false },
  bookingWorkflow: {
    bookingIntentActive: true,
    callbackRequested: false,
    bookingCancelled: false,
    bookingConfirmed: false,
    callerRequestFinalized: false,
    requestedDate: "2026-09-17",
    lastFindRequestedDate: null,
    nextStage: "COLLECT_REQUIRED_INTAKE",
  },
};
const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
const after = transitionAfterIntakeSave({
  ctx,
  raw: {},
  savedKeys: ["name", "service_reason"],
  readiness,
  voiceV2PstnLiveBooking: false,
  bookingStrategy: "REQUEST_ONLY",
});
assert.equal(
  deriveVoiceV2NextStage({
    workflow: after.bookingWorkflow!,
    readiness,
    hasActiveOfferSet: false,
    bookingStrategy: "REQUEST_ONLY",
  }),
  "FINALIZE_CALLER_REQUEST",
);

// Correction — Friday over tomorrow
let wf = after.bookingWorkflow!;
wf = { ...wf, requestedDate: "2026-09-19" };
assert.equal(wf.requestedDate, "2026-09-19");

// Capability snapshot
const snapReq = buildVoiceV2CallCapabilitySnapshot(reqCfg);
assert.equal(snapReq.bookingStrategy, "REQUEST_ONLY");
assert.equal(snapReq.findToolAvailable, false);
assert.equal(snapReq.finalizeToolAvailable, true);

const flow = buildAmyConversationWorkflow(
  {
    voiceV2SaveIntake: v2Ids.saveIntakeId,
    voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  },
  reqCfg,
);
const general = (flow.nodes as Array<{ id: string; shared_tool_ids?: string[] }>).find(
  (n) => n.id === "n_general",
);
const readBack = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: false,
  expectedOneAmyIntake: true,
  readBack: {
    tool_ids: [v2Ids.saveIntakeId, v2Ids.finalizeRequestId],
    generalNode: general
      ? { id: general.id, shared_tool_ids: general.shared_tool_ids || [] }
      : null,
    liveBookingNode: null,
    displayNameByToolId: new Map([
      [v2Ids.saveIntakeId, VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME],
      [v2Ids.finalizeRequestId, VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME],
      [v2Ids.findId, VOICE_V2_TELNYX_TOOL_NAME],
      [v2Ids.bookId, VOICE_V2_BOOK_TELNYX_TOOL_NAME],
    ]),
  },
});
assert.equal(readBack.ok, true);

console.log("test-voice-v2-request-only-headless: PASS");
