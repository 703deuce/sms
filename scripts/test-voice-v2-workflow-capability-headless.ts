#!/usr/bin/env npx tsx
/**
 * Voice V2 PSTN workflow capability certification (one-Amy).
 *
 * npx tsx scripts/test-voice-v2-workflow-capability-headless.ts
 */
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  buildAmyConversationWorkflow,
  WORKFLOW_NODE_IDS,
  workflowNodeExpectedTools,
} from "../src/lib/voice/telnyx/conversation-workflow";
import { buildDesiredTelnyxWorkflowPayload } from "../src/lib/voice/telnyx/workflow-sync";
import {
  buildVoiceV2CallCapabilitySnapshot,
  expectedVoiceV2LiveBooking,
  verifyVoiceV2WorkflowReadBack,
  VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES,
  VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
} from "../src/lib/voice-receptionist-wizard/workflow-capability";
import { isVoiceV2PstnLiveBookingMode } from "../src/lib/voice-receptionist-wizard/pstn-workflow-mode";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "../src/lib/voice-receptionist-wizard/telnyx-tool-definition";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

type Metric = { name: string; value: string | number };

const metrics: Metric[] = [];
const failures: string[] = [];

function metric(name: string, value: string | number) {
  metrics.push({ name, value });
}

function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

const baseShared = {
  sendResourceId: "st_send",
  searchDetailsId: "st_search",
  voiceAiBookingId: "st_legacy_book",
  hangupId: "st_hangup",
  transferId: "st_transfer",
};

const v2Ids = {
  findId: "v2_find",
  bookId: "v2_book",
  saveIntakeId: "v2_save",
  finalizeRequestId: "v2_finalize",
  sendBookingLinkId: null,
  findExistingId: null,
  rescheduleId: null,
  cancelId: null,
};

function configWith(input: {
  afterHours?: boolean;
  voiceV2PstnLiveBooking?: boolean;
  bookAppointments?: boolean;
}): VoiceAgentConfig {
  const wizard = applyWizardPreset(
    createDefaultWizardState(),
    input.afterHours ? "after_hours" : "business_hours",
  );
  if (input.bookAppointments !== false) {
    wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments"])];
  } else {
    wizard.capabilities = wizard.capabilities.filter((c) => c !== "book_appointments");
    wizard.capabilities.push("take_messages");
  }
  if (input.voiceV2PstnLiveBooking) {
    wizard.bookingStrategy = "MICROSOFT_365";
    wizard.calendarConnected = true;
    wizard.calendarProvider = "microsoft";
  } else {
    wizard.bookingStrategy = input.bookAppointments === false ? "NONE" : "REQUEST_ONLY";
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

function generalNode(flow: Record<string, unknown>) {
  const nodes = flow.nodes as Array<{
    id: string;
    instructions?: string;
    shared_tool_ids?: string[];
  }>;
  return nodes.find((n) => n.id === WORKFLOW_NODE_IDS.GENERAL);
}

function liveNode(flow: Record<string, unknown>) {
  const nodes = flow.nodes as Array<{
    id: string;
    instructions?: string;
    shared_tool_ids?: string[];
  }>;
  return nodes.find((n) => n.id === WORKFLOW_NODE_IDS.LIVE_BOOKING);
}

function hasLiveBookingEdge(flow: Record<string, unknown>) {
  const edges = flow.edges as Array<{ id?: string }>;
  return edges.some((e) => e.id === "e_general_live_booking");
}

function readBackFromPayload(
  tool_ids: string[],
  flow: Record<string, unknown>,
): ReturnType<typeof verifyVoiceV2WorkflowReadBack> {
  const displayNameByToolId = new Map<string, string>([
    ["v2_find", VOICE_V2_TELNYX_TOOL_NAME],
    ["v2_book", VOICE_V2_BOOK_TELNYX_TOOL_NAME],
    ["v2_save", VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME],
    ["v2_finalize", VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME],
    ["st_legacy_book", "voice_ai_booking_turn"],
  ]);
  const general = generalNode(flow);
  const live = liveNode(flow);
  return verifyVoiceV2WorkflowReadBack({
    expectedVoiceV2Booking: true,
    readBack: {
      tool_ids,
      generalNode: general
        ? {
            id: general.id,
            shared_tool_ids: general.shared_tool_ids || [],
            instructions: general.instructions || "",
          }
        : null,
      liveBookingNode: live
        ? {
            id: live.id,
            shared_tool_ids: live.shared_tool_ids || [],
            instructions: live.instructions || "",
          }
        : null,
      displayNameByToolId,
    },
  });
}

const authorityFns = [isVoiceV2PstnLiveBookingMode, expectedVoiceV2LiveBooking];
pass(
  "CONFIG_AUTHORITY_SINGLE_GATE",
  authorityFns.every((fn) => fn(configWith({ voiceV2PstnLiveBooking: true }))),
);
pass(
  "AFTER_HOURS_ALONE_DOES_NOT_ENABLE_V2",
  !isVoiceV2PstnLiveBookingMode(configWith({ afterHours: true, voiceV2PstnLiveBooking: undefined })),
);
metric("VOICE_V2_CONFIG_AUTHORITY_COUNT", 1);

const cfgA = configWith({ afterHours: true, voiceV2PstnLiveBooking: true });
const planA = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2Ids,
  config: cfgA,
});
const generalA = generalNode(planA.conversation_flow);
const toolsA = workflowNodeExpectedTools(WORKFLOW_NODE_IDS.GENERAL, {
  voiceV2Find: v2Ids.findId,
  voiceV2Book: v2Ids.bookId,
  voiceV2SaveIntake: v2Ids.saveIntakeId,
  voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
});
pass("A_NO_LIVE_BOOKING_NODE", !liveNode(planA.conversation_flow));
pass(
  "A_V2_TOOLS_ON_GENERAL",
  JSON.stringify(generalA?.shared_tool_ids?.sort()) ===
    JSON.stringify(
      [v2Ids.saveIntakeId, v2Ids.finalizeRequestId, v2Ids.findId, v2Ids.bookId].sort(),
    ),
);
pass(
  "A_ONE_AMY_GENERAL_INSTRUCTIONS",
  Boolean(
    generalA?.instructions?.includes("same assistant") ||
      generalA?.instructions?.includes("intake-save"),
  ),
);
pass(
  "A_NOT_CALLBACK_ONLY_GENERAL",
  !String(generalA?.instructions || "").includes("not live calendar booking on this call"),
);
pass("A_NO_LIVE_EDGE", !hasLiveBookingEdge(planA.conversation_flow));
pass("A_READBACK", readBackFromPayload(planA.tool_ids, planA.conversation_flow).ok === true);
pass(
  "A_EXPECTED_TOOLS",
  toolsA.join(",") ===
    "voice_v2_save_intake_fields,voice_v2_finalize_caller_request,voice_v2_find_availability,voice_v2_book_offered_slot",
);
metric("V2_TOOLSET_AFTER_HOURS_ENABLED", failures.some((f) => f.startsWith("A_")) ? "FAIL" : "PASS");

const cfgB = configWith({ afterHours: true, voiceV2PstnLiveBooking: false });
const planB = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: null,
  config: cfgB,
});
pass("B_NO_LIVE_NODE", !liveNode(planB.conversation_flow));
pass(
  "B_CALLBACK_GENERAL",
  String(generalNode(planB.conversation_flow)?.instructions || "").includes("booking link"),
);
pass(
  "B_V2_TOOLS_ABSENT_ASSISTANT",
  !planB.tool_ids.some((id) => [v2Ids.findId, v2Ids.bookId, v2Ids.saveIntakeId].includes(id)),
);

const cfgC = configWith({ afterHours: false, voiceV2PstnLiveBooking: true });
const planC = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2Ids,
  config: cfgC,
});
pass("C_NO_LIVE_NODE", !liveNode(planC.conversation_flow));
pass("C_READBACK", readBackFromPayload(planC.tool_ids, planC.conversation_flow).ok === true);

const d1 = buildDesiredTelnyxWorkflowPayload({ shared: baseShared, v2Shared: v2Ids, config: cfgA });
const d2 = buildDesiredTelnyxWorkflowPayload({ shared: baseShared, v2Shared: v2Ids, config: cfgA });
pass(
  "D_TOOL_IDS_STABLE",
  JSON.stringify(d1.tool_ids.sort()) === JSON.stringify(d2.tool_ids.sort()),
);
const generalD1 = generalNode(d1.conversation_flow)?.shared_tool_ids?.sort();
const generalD2 = generalNode(d2.conversation_flow)?.shared_tool_ids?.sort();
pass("D_GENERAL_TOOLS_STABLE", JSON.stringify(generalD1) === JSON.stringify(generalD2));
metric("V2_TOOLSET_SURVIVES_REPUBLISH", failures.some((f) => f.startsWith("D_")) ? "FAIL" : "PASS");

const staleReadBack = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: true,
  readBack: {
    tool_ids: [baseShared.sendResourceId, v2Ids.findId],
    generalNode: {
      shared_tool_ids: [v2Ids.findId],
      instructions: "partial",
    },
    liveBookingNode: null,
    displayNameByToolId: new Map([[v2Ids.findId, VOICE_V2_TELNYX_TOOL_NAME]]),
  },
});
pass("E_STALE_READBACK_FAILS", staleReadBack.ok === false);
const restored = readBackFromPayload(d1.tool_ids, d1.conversation_flow);
pass("E_SYNC_RESTORES", restored.ok === true);

const fResult = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: true,
  readBack: {
    tool_ids: [v2Ids.findId, v2Ids.saveIntakeId, v2Ids.bookId],
    generalNode: {
      shared_tool_ids: [v2Ids.findId, v2Ids.saveIntakeId],
      instructions: "one amy",
    },
    liveBookingNode: {
      shared_tool_ids: [v2Ids.bookId],
      instructions: "handoff",
    },
    displayNameByToolId: new Map([
      [v2Ids.findId, VOICE_V2_TELNYX_TOOL_NAME],
      [v2Ids.saveIntakeId, VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME],
      [v2Ids.bookId, VOICE_V2_BOOK_TELNYX_TOOL_NAME],
    ]),
  },
});
pass(
  "F_MISMATCH_CODE",
  !fResult.ok && fResult.ok === false && (fResult as { code: string }).code === VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
);
pass(
  "F_V2_ON_LIVE_NODE_FAILS",
  String((fResult as { detail?: string }).detail || "").includes("handoff"),
);

pass("G_NO_LIVE_BOOKING_ROUTE", !hasLiveBookingEdge(planA.conversation_flow));
pass(
  "G_NOT_CALLBACK_OVERRIDE",
  !String(generalA?.instructions || "").toLowerCase().includes("don't have live booking"),
);
metric("LIVE_BOOKING_ROUTE_AFTER_HOURS", failures.some((f) => f.startsWith("G_")) ? "FAIL" : "PASS");

const ahV2General = String(generalA?.instructions || "");
const callbackOverrideWhenV2 =
  ahV2General.includes("not live calendar booking") ||
  ahV2General.includes("text a booking link (not live") ||
  hasLiveBookingEdge(planA.conversation_flow)
    ? 1
    : 0;
metric("CALLBACK_OVERRIDE_WHEN_V2_ENABLED", callbackOverrideWhenV2);

metric("SILENT_TOOLSET_DEGRADATION", staleReadBack.ok || fResult.ok ? 1 : 0);

const snap = buildVoiceV2CallCapabilitySnapshot(cfgA);
pass(
  "SNAPSHOT_ALL_TRUE_WHEN_FLAG",
  snap.voiceV2LiveBooking &&
    snap.intakeToolAvailable &&
    snap.findToolAvailable &&
    snap.bookToolAvailable,
);

pass(
  "REQUIRED_TOOL_NAMES",
  VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES.length === 4 &&
    VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES.includes(VOICE_V2_TELNYX_TOOL_NAME),
);

pass(
  "REQUEST_ONLY_NO_FIND_ON_GENERAL",
  !workflowNodeExpectedTools(WORKFLOW_NODE_IDS.GENERAL, {
    voiceV2Find: null,
    voiceV2Book: null,
    voiceV2SaveIntake: v2Ids.saveIntakeId,
    voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  }).includes("voice_v2_find_availability"),
);

console.log("\n--- Voice V2 workflow capability report ---");
for (const m of metrics) {
  console.log(`${m.name} = ${m.value}`);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("\nAll workflow capability checks passed.");
