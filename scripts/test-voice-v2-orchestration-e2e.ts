#!/usr/bin/env tsx
/**
 * Production Voice V2 orchestration harness — no Telnyx, GPT-Live, or audio.
 * VOICE_V2_TEST_EXECUTORS=fake (default) uses injected FIND/BOOK executors.
 */
import "./preload-server-only.mjs";

import { buildInterpreterContext } from "@/lib/voice-v2/build-interpreter-context";
import { interpretStableCallerUtterance } from "@/lib/voice-v2/resolve-caller-interpreter";
import { defaultVoiceV2BookingWorkflow } from "@/lib/voice-v2/booking-workflow";
import { setVoiceV2CallContext, clearVoiceV2CallSessions } from "@/lib/voice-v2/intake/session-store";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";
import {
  ORCHESTRATION_INTAKE_SCHEMA,
  VoiceV2OrchestrationHarness,
  buildCallerMeaning,
  resetOrchestrationTestWorld,
} from "@/lib/voice-v2/testing/orchestration-harness";
import { VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { effectiveRequestedDate } from "@/lib/voice-v2/scheduling-preference-state";

process.env.VOICE_V2_TEST_EXECUTORS = process.env.VOICE_V2_TEST_EXECUTORS || "fake";
process.env.VOICE_V2_ASTRA_INTERPRETER = "0";

let failures = 0;

function fail(msg: string) {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

function pass(label: string) {
  console.info(`PASS: ${label}`);
}

async function testStableUtteranceInterpreterHandoff() {
  clearVoiceV2CallSessions();
  const sessionKey = "cc:interp_handoff";
  const ctx: VoiceV2CallContext = {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/New_York",
    intakeSchema: ORCHESTRATION_INTAKE_SCHEMA,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { voiceV2PstnLiveBooking: true, bookingStrategy: "MICROSOFT_365" },
    bookingWorkflow: defaultVoiceV2BookingWorkflow(),
  };
  setVoiceV2CallContext(ctx);
  const stable = {
    utterance_id: "utt_interp_1",
    revision: 1,
    start_ms: 0,
    end_ms: 100,
    stable_at: Date.now(),
    text: "I need an appointment",
  };
  const interpreterCtx = await buildInterpreterContext({
    stable,
    fullConversationTranscript: stable.text,
    callContext: ctx,
    currentWorkflowStage: "COLLECT_REQUIRED_INTAKE",
    callId: "TEST_INTERP",
  });
  const result = await interpretStableCallerUtterance(interpreterCtx);
  if (!result.meaning) {
    fail("STABLE_UTTERANCE_CREATED but interpretStableCallerUtterance returned no meaning");
    return;
  }
  if (result.mergePolicy === "none" && result.meaning.active_goal === "UNKNOWN") {
    fail(
      `Interpreter handoff produced preserve_state only (reason=${result.fallbackReason}) — expected BOOK_APPOINTMENT`,
    );
    return;
  }
  if (result.meaning.active_goal !== "BOOK_APPOINTMENT") {
    fail(`Expected BOOK_APPOINTMENT, got ${result.meaning.active_goal}`);
    return;
  }
  pass("stable utterance → interpretStableCallerUtterance → BOOK_APPOINTMENT");
}

async function scenario1_dateBeforeIntake() {
  resetOrchestrationTestWorld();
  const h = new VoiceV2OrchestrationHarness({ callId: "TEST_CALL_001" });
  await h.mergeMeaning(
    buildCallerMeaning({
      facts: { requested_date: "2026-09-25", requested_daypart: "morning" },
      evidence: "September 25th morning",
    }),
  );
  h.assertStage("COLLECT_REQUIRED_INTAKE");
  h.assertRequiredAction(null);
  if (h.snapshot().requested_date !== "2026-09-25") {
    fail(`scenario1 step1: requested_date not persisted (got ${h.snapshot().requested_date})`);
  }

  await h.mergeMeaning(
    buildCallerMeaning({
      literal_intake_fields: { name: "Anthony Johnson" },
      evidence: "Anthony Johnson",
    }),
  );
  h.assertStage("COLLECT_REQUIRED_INTAKE");

  await h.mergeMeaning(
    buildCallerMeaning({
      literal_intake_fields: { email: "anthony@example.com" },
      evidence: "anthony@example.com",
    }),
  );
  h.assertStage("OFFER_SLOTS");
  h.assertRequiredAction(null);
  if (h.snapshot().dispatch_counts.find !== 1) {
    fail(`scenario1: FIND should run once on intake complete, got ${h.snapshot().dispatch_counts.find}`);
  }

  await h.mergeMeaning(
    buildCallerMeaning({
      facts: { selected_slot_ordinal: 2 },
      evidence: "the second one",
    }),
  );
  if (h.snapshot().selected_slot_id !== "slot_1000") {
    fail(`scenario1: expected slot_1000, got ${h.snapshot().selected_slot_id}`);
  }
  h.assertStage("BOOKING_CONFIRMED");
  if (!h.snapshot().booking_confirmed) fail("scenario1: booking_confirmed false");
  h.assertRequiredAction(null);
  if (h.snapshot().dispatch_counts.find !== 1) {
    fail(`scenario1: FIND count ${h.snapshot().dispatch_counts.find} expected 1`);
  }
  if (h.snapshot().dispatch_counts.book !== 1) {
    fail(`scenario1: BOOK count ${h.snapshot().dispatch_counts.book} expected 1`);
  }
  pass("scenario1 scheduling fact before intake → FIND → BOOK");
  h.dispose();
}

async function scenario2_intakeBeforeDate() {
  resetOrchestrationTestWorld();
  const h = new VoiceV2OrchestrationHarness({ callId: "TEST_CALL_002" });
  await h.mergeMeaning(
    buildCallerMeaning({
      literal_intake_fields: { name: "Anthony Johnson" },
      evidence: "Anthony Johnson",
    }),
  );
  await h.mergeMeaning(
    buildCallerMeaning({
      literal_intake_fields: { email: "anthony@example.com" },
      evidence: "anthony@example.com",
    }),
  );
  h.assertStage("COLLECT_SCHEDULING_PREFERENCE");
  await h.mergeMeaning(
    buildCallerMeaning({
      facts: { requested_date: "2026-09-25" },
      evidence: "September 25th",
    }),
  );
  if (h.controlPlane.getStage() !== "OFFER_SLOTS" && h.controlPlane.getStage() !== "FIND_AVAILABILITY") {
    fail(`scenario2: expected FIND/OFFER after date, got ${h.controlPlane.getStage()}`);
  }
  if (h.snapshot().dispatch_counts.find !== 1) {
    fail(`scenario2: FIND should run exactly once, got ${h.snapshot().dispatch_counts.find}`);
  }
  pass("scenario2 intake before date");
  h.dispose();
}

async function scenario3_allFactsOneUtterance() {
  resetOrchestrationTestWorld();
  const h = new VoiceV2OrchestrationHarness({ callId: "TEST_CALL_003" });
  await h.mergeMeaning(
    buildCallerMeaning({
      evidence: "I'm Anthony Johnson, anthony@example.com. I need Friday morning.",
      literal_intake_fields: {
        name: "Anthony Johnson",
        email: "anthony@example.com",
      },
      facts: { requested_date: "2026-09-26", requested_daypart: "morning" },
    }),
  );
  const stage = h.controlPlane.getStage();
  const okStages = ["FIND_AVAILABILITY", "COLLECT_SCHEDULING_PREFERENCE", "OFFER_SLOTS"];
  if (!okStages.includes(stage)) {
    fail(`scenario3: expected FIND/scheduling/OFFER after full facts, got ${stage}`);
  }
  if (h.snapshot().dispatch_counts.find < 1 && stage === "OFFER_SLOTS") {
    fail("scenario3: OFFER_SLOTS without FIND dispatch");
  }
  pass("scenario3 all facts one merge");
  h.dispose();
}

async function scenario4_correctionBeforeFind() {
  resetOrchestrationTestWorld();
  const h = new VoiceV2OrchestrationHarness({ callId: "TEST_CALL_004" });
  await h.mergeMeaning(
    buildCallerMeaning({
      literal_intake_fields: { name: "Anthony Johnson", email: "anthony@example.com" },
      facts: { requested_date: "2026-09-26" },
      evidence: "Friday",
    }),
  );
  await h.mergeMeaning(
    buildCallerMeaning({
      facts: { requested_date: "2026-09-25" },
      corrections: ["requested_date"],
      evidence: "use structured date correction only",
    }),
  );
  const ctx = h.controlPlane.getCallContext();
  const date = ctx ? effectiveRequestedDate(ctx) : null;
  if (date !== "2026-09-25") {
    fail(`scenario4: expected Thursday 2026-09-25, got ${date}`);
  }
  pass("scenario4 date correction before FIND");
  h.dispose();
}

async function scenario6_ambiguousSlotNoBook() {
  resetOrchestrationTestWorld();
  const h = new VoiceV2OrchestrationHarness({ callId: "TEST_CALL_006" });
  await h.mergeMeaning(
    buildCallerMeaning({
      literal_intake_fields: { name: "Anthony Johnson", email: "anthony@example.com" },
      facts: { requested_date: "2026-09-25" },
    }),
  );
  await h.runTurn("find");
  await h.mergeMeaning(
    buildCallerMeaning({
      ambiguities: ["slot_reference_unclear"],
      facts: {},
      evidence: "the later one maybe",
    }),
    { mergePolicy: "none" },
  );
  h.assertRequiredAction(null);
  if (h.snapshot().dispatch_counts.book > 0) {
    fail("scenario6: BOOK should not run on ambiguous selection");
  }
  pass("scenario6 ambiguous slot — no auto BOOK");
  h.dispose();
}

async function scenario9_interpreterFailurePreservesState() {
  resetOrchestrationTestWorld();
  const h = new VoiceV2OrchestrationHarness({ callId: "TEST_CALL_009" });
  await h.mergeMeaning(
    buildCallerMeaning({
      facts: { requested_date: "2026-09-25" },
      literal_intake_fields: { name: "Anthony Johnson" },
    }),
  );
  const before = JSON.stringify(h.controlPlane.getCallContext()?.schedulingPreference ?? null);
  await h.mergeMeaning(
    buildCallerMeaning({
      ambiguities: ["unclear"],
      evidence: "uh",
    }),
    { mergePolicy: "none" },
  );
  const after = JSON.stringify(h.controlPlane.getCallContext()?.schedulingPreference ?? null);
  if (before !== after) {
    fail("scenario9: scheduling preference changed on merge_policy none");
  }
  pass("scenario9 preserve state on none merge");
  h.dispose();
}

async function main() {
  console.info("=== Voice V2 orchestration e2e (production path) ===\n");
  await testStableUtteranceInterpreterHandoff();
  await scenario1_dateBeforeIntake();
  await scenario2_intakeBeforeDate();
  await scenario3_allFactsOneUtterance();
  await scenario4_correctionBeforeFind();
  await scenario6_ambiguousSlotNoBook();
  await scenario9_interpreterFailurePreservesState();

  if (failures > 0) {
    console.error(`\n${failures} scenario(s) FAILED`);
    process.exit(1);
  }
  console.info("\nAll orchestration scenarios PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
