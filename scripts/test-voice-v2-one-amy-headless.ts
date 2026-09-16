#!/usr/bin/env npx tsx
/**
 * One-Amy Voice V2 minimum build gates (directive §16).
 * npx tsx scripts/test-voice-v2-one-amy-headless.ts
 */
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  WORKFLOW_NODE_IDS,
  workflowNodeExpectedTools,
} from "../src/lib/voice/telnyx/conversation-workflow";
import { buildDesiredTelnyxWorkflowPayload } from "../src/lib/voice/telnyx/workflow-sync";
import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { AMY_V2_CORE_STATIC_PROMPT } from "../src/lib/voice-v2/one-amy/amy-core-static-prompt";
import {
  isBookingIntentOnlyServiceReason,
  stripBookingIntentOnlyServiceReason,
} from "../src/lib/voice-v2/intake/booking-intent-guard";
import { verifyVoiceV2WorkflowReadBack } from "../src/lib/voice-v2/workflow-capability";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "../src/lib/voice-v2/telnyx-tool-definition";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function v2Config(): VoiceAgentConfig {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments"])];
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      bookingStrategy: "MICROSOFT_365",
      voiceV2PstnLiveBooking: true,
      conversationWorkflowMode: true,
    },
  } as VoiceAgentConfig);
}

const cfg = v2Config();
const flow = buildDesiredTelnyxWorkflowPayload({
  shared: {
    sendResourceId: "st_send",
    searchDetailsId: "st_search",
    voiceAiBookingId: "st_legacy",
    hangupId: "st_hangup",
    transferId: "st_transfer",
  },
  v2Shared: {
    findId: "v2_find",
    bookId: "v2_book",
    saveIntakeId: "v2_save",
    finalizeRequestId: "v2_finalize",
  },
  config: cfg,
}).conversation_flow;

const nodes = flow.nodes as Array<{ id: string; shared_tool_ids?: string[]; instructions?: string }>;
const edges = flow.edges as Array<{ id?: string }>;
const general = nodes.find((n) => n.id === WORKFLOW_NODE_IDS.GENERAL);
const liveBooking = nodes.find((n) => n.id === WORKFLOW_NODE_IDS.LIVE_BOOKING);

pass("CONVERSATIONAL_NODE_COUNT", Boolean(general) && !liveBooking);
pass("LIVE_BOOKING_NODE_COUNT", !liveBooking);
pass(
  "GENERAL_TO_BOOKING_EDGE_COUNT",
  edges.filter((e) => e.id === "e_general_live_booking").length === 0,
);
pass(
  "V2_TOOLS_ON_GENERAL",
  JSON.stringify(general?.shared_tool_ids?.sort()) ===
    JSON.stringify(["v2_save", "v2_find", "v2_book", "v2_finalize"].sort()),
);

const toolsOnGeneral = workflowNodeExpectedTools(WORKFLOW_NODE_IDS.GENERAL, {
  voiceV2Find: "v2_find",
  voiceV2Book: "v2_book",
  voiceV2SaveIntake: "v2_save",
  voiceV2FinalizeRequest: "v2_finalize",
});
pass("SECOND_CONVERSATIONAL_AGENT", !liveBooking && toolsOnGeneral.length === 4);

pass("BOOKING_INTENT_DETECT", isBookingIntentOnlyServiceReason("I need to book an appointment"));
pass("BOOKING_INTENT_DETECT_2", isBookingIntentOnlyServiceReason("book an appointment"));
pass("REAL_SERVICE_REASON", !isBookingIntentOnlyServiceReason("kitchen sink is leaking"));

const stripped = stripBookingIntentOnlyServiceReason({
  name: "Anthony",
  service_reason: "schedule an appointment",
});
pass("STRIP_FAKE_SR", stripped.name === "Anthony" && !stripped.service_reason);

const snapshot = compileReceptionistConfig({
  agentName: "Amy",
  businessName: "Test Plumbing",
  businessDescription: "We fix sinks.",
  greeting: "Hi",
  language: "en-US",
  timezone: "America/Los_Angeles",
  answerTiming: "after_hours",
  capabilities: ["book_appointments", "answer_questions"],
  collectFields: [],
  voiceId: "test",
  advanced: cfg.advanced,
});

pass("ONE_AMY_PROMPT_LAYER", snapshot.compiledPrompt.startsWith(AMY_V2_CORE_STATIC_PROMPT.slice(0, 40)));
pass(
  "NO_HANDOFF_IN_PROMPT",
  !snapshot.compiledPrompt.toLowerCase().includes("transfer you to our booking"),
);
pass("ONE_AMY_FLAG", snapshot.voiceV2OneAmy === true);
pass(
  "MULTI_FIELD_POLICY",
  snapshot.compiledPrompt.includes("save them in one call") ||
    snapshot.compiledPrompt.includes("together in one call"),
);
pass("FAKE_BOOKING_INTAKE_SAVES", isBookingIntentOnlyServiceReason("book an appointment"));

const readBack = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: true,
  readBack: {
    tool_ids: ["v2_find", "v2_book", "v2_save", "v2_finalize"],
    generalNode: {
      id: WORKFLOW_NODE_IDS.GENERAL,
      shared_tool_ids: ["v2_save", "v2_find", "v2_book", "v2_finalize"],
      instructions: String(general?.instructions || ""),
    },
    liveBookingNode: null,
    displayNameByToolId: new Map([
      ["v2_find", VOICE_V2_TELNYX_TOOL_NAME],
      ["v2_book", VOICE_V2_BOOK_TELNYX_TOOL_NAME],
      ["v2_save", VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME],
      ["v2_finalize", VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME],
    ]),
  },
});
pass("WORKFLOW_READBACK_ONE_AMY", readBack.ok === true);

const staticTokens = Math.ceil(AMY_V2_CORE_STATIC_PROMPT.length / 4);
const wizardTokens = Math.ceil(
  (snapshot.compiledPrompt.length - AMY_V2_CORE_STATIC_PROMPT.length) / 4,
);
console.log("\n--- One-Amy headless report ---");
console.log(`STATIC_CORE_PROMPT_TOKENS ≈ ${staticTokens}`);
console.log(`WIZARD_CONTEXT_TOKENS ≈ ${wizardTokens}`);
console.log(`TOTAL_EFFECTIVE_PROMPT_TOKENS ≈ ${Math.ceil(snapshot.compiledPrompt.length / 4)}`);
console.log(`GENERAL_TO_BOOKING_EDGE_COUNT = ${edges.filter((e) => e.id === "e_general_live_booking").length}`);
console.log(`LIVE_BOOKING_NODE_COUNT = ${liveBooking ? 1 : 0}`);
console.log(
  `BOOKING_INTENT_TOOL_CALLS = ${isBookingIntentOnlyServiceReason("I need to book an appointment") ? 0 : "FAIL"}`,
);

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("\nAll one-Amy headless checks passed.");
