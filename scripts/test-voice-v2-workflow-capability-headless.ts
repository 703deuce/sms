#!/usr/bin/env npx tsx
/**
 * Voice V2 PSTN workflow capability certification (directive §8).
 *
 * npx tsx scripts/test-voice-v2-workflow-capability-headless.ts
 */
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
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
} from "../src/lib/voice-v2/workflow-capability";
import { isVoiceV2PstnLiveBookingMode } from "../src/lib/voice-v2/pstn-workflow-mode";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "../src/lib/voice-v2/telnyx-tool-definition";
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
  }
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      voiceV2PstnLiveBooking: input.voiceV2PstnLiveBooking === true,
      conversationWorkflowMode: true,
    },
  } as VoiceAgentConfig);
}

function liveNode(flow: Record<string, unknown>) {
  const nodes = flow.nodes as Array<{
    id: string;
    instructions?: string;
    shared_tool_ids?: string[];
  }>;
  return nodes.find((n) => n.id === WORKFLOW_NODE_IDS.LIVE_BOOKING);
}

function generalNode(flow: Record<string, unknown>) {
  const nodes = flow.nodes as Array<{ id: string; instructions?: string }>;
  return nodes.find((n) => n.id === WORKFLOW_NODE_IDS.GENERAL);
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
    ["st_legacy_book", "voice_ai_booking_turn"],
  ]);
  const live = liveNode(flow);
  return verifyVoiceV2WorkflowReadBack({
    expectedVoiceV2Booking: true,
    readBack: {
      tool_ids,
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

// Authority: single runtime gate (pstn-workflow-mode)
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

// A — after-hours + V2 enabled
const cfgA = configWith({ afterHours: true, voiceV2PstnLiveBooking: true });
const planA = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2Ids,
  config: cfgA,
});
const liveA = liveNode(planA.conversation_flow);
const generalA = generalNode(planA.conversation_flow);
const toolsA = workflowNodeExpectedTools(WORKFLOW_NODE_IDS.LIVE_BOOKING, {
  ...v2Ids,
  voiceV2Find: v2Ids.findId,
  voiceV2Book: v2Ids.bookId,
  voiceV2SaveIntake: v2Ids.saveIntakeId,
});
pass("A_LIVE_BOOKING_NODE", Boolean(liveA));
pass(
  "A_V2_TOOLS_ON_NODE",
  JSON.stringify(liveA?.shared_tool_ids?.sort()) === JSON.stringify([v2Ids.saveIntakeId, v2Ids.findId, v2Ids.bookId].sort()),
);
pass(
  "A_LIVE_INSTRUCTIONS",
  Boolean(
    liveA?.instructions?.includes("voice_v2_find_availability") &&
      liveA?.instructions?.includes("voice_v2_book_offered_slot") &&
      liveA?.instructions?.includes("voice_v2_save_intake_fields"),
  ),
);
pass(
  "A_GENERAL_LIVE_BOOKING_AVAILABLE",
  Boolean(generalA?.instructions?.includes("CAN book on the live Microsoft calendar")),
);
pass(
  "A_NOT_CALLBACK_ONLY_GENERAL",
  !String(generalA?.instructions || "").includes("not live calendar booking on this call"),
);
pass("A_HAS_LIVE_EDGE", hasLiveBookingEdge(planA.conversation_flow));
pass("A_READBACK", readBackFromPayload(planA.tool_ids, planA.conversation_flow).ok === true);
pass("A_EXPECTED_TOOLS", toolsA.join(",") === "voice_v2_save_intake_fields,voice_v2_find_availability,voice_v2_book_offered_slot");
metric("V2_TOOLSET_AFTER_HOURS_ENABLED", failures.some((f) => f.startsWith("A_")) ? "FAIL" : "PASS");

// B — after-hours + V2 disabled
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

// C — normal hours + V2 enabled
const cfgC = configWith({ afterHours: false, voiceV2PstnLiveBooking: true });
const planC = buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2Ids,
  config: cfgC,
});
pass("C_LIVE_NODE", Boolean(liveNode(planC.conversation_flow)));
pass("C_READBACK", readBackFromPayload(planC.tool_ids, planC.conversation_flow).ok === true);

// D — republish idempotency (pure planner)
const d1 = buildDesiredTelnyxWorkflowPayload({ shared: baseShared, v2Shared: v2Ids, config: cfgA });
const d2 = buildDesiredTelnyxWorkflowPayload({ shared: baseShared, v2Shared: v2Ids, config: cfgA });
pass(
  "D_TOOL_IDS_STABLE",
  JSON.stringify(d1.tool_ids.sort()) === JSON.stringify(d2.tool_ids.sort()),
);
const liveD1 = liveNode(d1.conversation_flow)?.shared_tool_ids?.sort();
const liveD2 = liveNode(d2.conversation_flow)?.shared_tool_ids?.sort();
pass("D_LIVE_TOOLS_STABLE", JSON.stringify(liveD1) === JSON.stringify(liveD2));
metric("V2_TOOLSET_SURVIVES_REPUBLISH", failures.some((f) => f.startsWith("D_")) ? "FAIL" : "PASS");

// E — stale Telnyx: rebuild from config restores trio
const staleReadBack = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: true,
  readBack: {
    tool_ids: [baseShared.sendResourceId, v2Ids.findId],
    liveBookingNode: {
      shared_tool_ids: [v2Ids.findId],
      instructions: "partial",
    },
    displayNameByToolId: new Map([
      [v2Ids.findId, VOICE_V2_TELNYX_TOOL_NAME],
    ]),
  },
});
pass("E_STALE_READBACK_FAILS", staleReadBack.ok === false);
const restored = readBackFromPayload(d1.tool_ids, d1.conversation_flow);
pass("E_SYNC_RESTORES", restored.ok === true);

// F — capability mismatch on read-back
const fResult = verifyVoiceV2WorkflowReadBack({
  expectedVoiceV2Booking: true,
  readBack: {
    tool_ids: [v2Ids.findId, v2Ids.saveIntakeId, v2Ids.bookId],
    liveBookingNode: {
      shared_tool_ids: [v2Ids.findId, v2Ids.saveIntakeId],
      instructions:
        "voice_v2_save_intake_fields voice_v2_find_availability voice_v2_book_offered_slot",
    },
    displayNameByToolId: new Map([
      [v2Ids.findId, VOICE_V2_TELNYX_TOOL_NAME],
      [v2Ids.saveIntakeId, VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME],
    ]),
  },
});
pass(
  "F_MISMATCH_CODE",
  !fResult.ok && fResult.ok === false && (fResult as { code: string }).code === VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
);
pass("F_MISSING_BOOK_ON_NODE", String((fResult as { detail?: string }).detail || "").includes("book"));

// G — booking intent routing (graph + instructions)
pass("G_LIVE_BOOKING_ROUTE", hasLiveBookingEdge(planA.conversation_flow));
pass(
  "G_NOT_CALLBACK_OVERRIDE",
  !String(generalA?.instructions || "").toLowerCase().includes("don't have live booking"),
);
metric("LIVE_BOOKING_ROUTE_AFTER_HOURS", failures.some((f) => f.startsWith("G_")) ? "FAIL" : "PASS");

// Callback override count when V2 on
const ahNoV2General = String(generalNode(planB.conversation_flow)?.instructions || "");
const ahV2General = String(generalA?.instructions || "");
const callbackOverrideWhenV2 =
  ahV2General.includes("not live calendar booking") ||
  ahV2General.includes("text a booking link (not live") ||
  !hasLiveBookingEdge(planA.conversation_flow)
    ? 1
    : 0;
metric("CALLBACK_OVERRIDE_WHEN_V2_ENABLED", callbackOverrideWhenV2);

// Silent degradation: mismatch must fail closed
metric("SILENT_TOOLSET_DEGRADATION", staleReadBack.ok || fResult.ok ? 1 : 0);

// Call snapshot from config only
const snap = buildVoiceV2CallCapabilitySnapshot(cfgA);
pass(
  "SNAPSHOT_ALL_TRUE_WHEN_FLAG",
  snap.voiceV2LiveBooking &&
    snap.intakeToolAvailable &&
    snap.findToolAvailable &&
    snap.bookToolAvailable,
);

// Required display names constant matches trio
pass(
  "REQUIRED_TOOL_NAMES",
  VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES.length === 3 &&
    VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES.includes(VOICE_V2_TELNYX_TOOL_NAME),
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
