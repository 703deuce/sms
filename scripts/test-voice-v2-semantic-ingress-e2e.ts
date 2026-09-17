#!/usr/bin/env tsx
/**
 * Production semantic ingress — stable utterance through live-stable-utterance-ingress → syncLiveCallerUtteranceIntent.
 * Chained after orchestration in `npm run test:voice-v2-orchestration`.
 * Optional: VOICE_V2_TEST_EXECUTORS=real (Microsoft FIND/BOOK) for integration — default fake.
 * Astra paths: VOICE_V2_ASTRA_INTERPRETER=1 + VOICE_V2_TEST_ASTRA_MOCK=success|timeout|fail.
 */
import "./preload-server-only.mjs";

import { effectiveRequestedDate } from "@/lib/voice-v2/scheduling-preference-state";
import {
  setVoiceV2TestAstraMode,
} from "@/lib/voice-v2/testing/astra-interpreter-test-hook";
import {
  VoiceV2SemanticIngressHarness,
  buildStableUtterance,
  resetSemanticIngressTestWorld,
} from "@/lib/voice-v2/testing/semantic-ingress-harness";
import { syncLiveCallerUtteranceIntent } from "@/lib/voice/telnyx/openai-live-bridge/live-caller-intent-sync";
import { beginUtteranceInterpretation } from "@/lib/voice/telnyx/openai-live-bridge/live-utterance-revision-guard";

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

async function testAppointmentBeforeControlPlaneReady() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_01" });
  const stable = buildStableUtterance("I need an appointment Friday morning");
  const queued = await h.ingress.ingestStableUtterance(stable);
  if (queued?.terminal !== "queued") {
    fail(`ingress_01: expected queued before ready, got ${queued?.terminal}`);
  }
  h.markControlPlaneReady("test");
  await new Promise((r) => setTimeout(r, 20));
  const ev = await h.speak("I need an appointment Friday morning", {
    utterance_id: stable.utterance_id,
    revision: 2,
    ready: true,
  });
  if (ev.terminal !== "interpreted") {
    fail(`ingress_01: expected interpreted after ready, got ${ev.terminal}`);
  } else {
    pass("utterance before control-plane ready → queue → replay → interpreted");
  }
  h.dispose();
}

async function testDateBeforeIntakeViaSpeech() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_02" });
  await h.speak("I need an appointment on September 25th in the morning");
  await h.speak("My name is Anthony Johnson");
  await h.speak("My email is anthony@example.com");
  const date = effectiveRequestedDate(h.orchestration.controlPlane.getCallContext()!);
  if (date !== "2026-09-25") {
    fail(`ingress_02: expected date 2026-09-25, got ${date}`);
  }
  const stage = h.orchestration.controlPlane.getStage();
  if (stage !== "OFFER_SLOTS" && stage !== "FIND_AVAILABILITY") {
    fail(`ingress_02: expected FIND/OFFER, got ${stage}`);
  } else {
    pass("date before name/email via stable utterances");
  }
  h.dispose();
}

async function testSplitEmailUtterance() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_03" });
  await h.speak("Anthony Johnson");
  await h.speak("anthony@example.com");
  const email = h.orchestration.controlPlane.getCallContext()?.intakeState.email?.value;
  if (email !== "anthony@example.com") {
    fail(`ingress_03: email not captured (${email})`);
  } else {
    pass("split intake utterances");
  }
  h.dispose();
}

async function testSplitEmailSpokenAt() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_03B" });
  await h.speak("My name is Anthony Johnson");
  await h.speak("My email is anthony at example dot com");
  const email = h.orchestration.controlPlane.getCallContext()?.intakeState.email?.value;
  if (email !== "anthony@example.com") {
    fail(`ingress_03b: spoken email not normalized (${email})`);
  } else {
    pass("split utterance: anthony at … → email captured");
  }
  h.dispose();
}

async function testCorrectionFridayThursday() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_04" });
  await h.speak("Anthony Johnson");
  await h.speak("anthony@example.com");
  await h.speak("September 26th");
  await h.speak("Actually September 25th instead");
  const date = effectiveRequestedDate(h.orchestration.controlPlane.getCallContext()!);
  if (date !== "2026-09-25") {
    fail(`ingress_04: correction failed, date=${date}`);
  } else {
    pass("Friday → Thursday correction");
  }
  h.dispose();
}

async function testConcurrentCalls() {
  resetSemanticIngressTestWorld();
  const a = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_A" });
  const b = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_B" });
  await Promise.all([
    a.speak("I want Friday September 26th morning. Anthony Johnson anthony@example.com"),
    b.speak("I want Thursday September 25th morning. Jane Doe jane@example.com"),
  ]);
  const dateA = effectiveRequestedDate(a.orchestration.controlPlane.getCallContext()!);
  const dateB = effectiveRequestedDate(b.orchestration.controlPlane.getCallContext()!);
  if (dateA === dateB) {
    fail("ingress_concurrent: dates must not leak between calls");
  } else {
    pass("concurrent calls isolated");
  }
  a.dispose();
  b.dispose();
}

async function testRevisionSuperseded() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_REV" });
  const utteranceId = "utt_rev_shared";
  const stableV1 = buildStableUtterance("Friday", { utterance_id: utteranceId, revision: 1 });
  const stableV2 = buildStableUtterance("Thursday", { utterance_id: utteranceId, revision: 2 });
  h.markControlPlaneReady("test");
  void syncLiveCallerUtteranceIntent({
    claims: {
      workspaceId: "ws_test",
      agentId: "agent_test",
      callId: h.orchestration.callId,
      callControlId: h.orchestration.callControlId,
    },
    callerUtterance: stableV1.text,
    fullConversationTranscript: stableV1.text,
    stableUtterance: stableV1,
    controlPlane: h.orchestration.controlPlane,
    sendLiveOut: () => {},
    dispatchContext: h.orchestration.dispatch,
    autoDispatch: true,
  });
  beginUtteranceInterpretation(h.orchestration.callId, stableV2);
  const r2 = await syncLiveCallerUtteranceIntent({
    claims: {
      workspaceId: "ws_test",
      agentId: "agent_test",
      callId: h.orchestration.callId,
      callControlId: h.orchestration.callControlId,
    },
    callerUtterance: stableV2.text,
    fullConversationTranscript: stableV2.text,
    stableUtterance: stableV2,
    controlPlane: h.orchestration.controlPlane,
    sendLiveOut: () => {},
    dispatchContext: h.orchestration.dispatch,
    autoDispatch: true,
  });
  if (r2.terminal !== "interpreted" && r2.terminal !== "superseded") {
    fail(`ingress_rev: unexpected terminal ${r2.terminal}`);
  } else {
    pass("revision supersede path (v2 authoritative)");
  }
  h.dispose();
}

async function testInterpreterDeterministicSuccess() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_AST" });
  const ev = await h.speak("I need to book an appointment");
  if (ev.terminal !== "interpreted") {
    fail(`ingress_ast: expected interpreted, got ${ev.terminal}`);
  } else {
    pass("interpreter success (deterministic / Astra-off path)");
  }
  h.dispose();
}

async function testFullChainToBookingConfirmed() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_FULL" });
  await h.speak("I need an appointment on September 25th in the morning");
  await h.speak("My name is Anthony Johnson");
  await h.speak("My email is anthony@example.com");
  const stageBeforeSlot = h.orchestration.controlPlane.getStage();
  if (stageBeforeSlot !== "OFFER_SLOTS") {
    fail(`ingress_full: expected OFFER_SLOTS before slot pick, got ${stageBeforeSlot}`);
    h.dispose();
    return;
  }
  await h.speak("the second one");
  if (!h.orchestration.controlPlane.isBookingConfirmed()) {
    fail(`ingress_full: expected BOOKING_CONFIRMED, stage=${h.orchestration.controlPlane.getStage()}`);
  } else {
    pass("full chain: stable utterance → … → BOOKING_CONFIRMED");
  }
  h.dispose();
}

async function testAstraMockSuccess() {
  resetSemanticIngressTestWorld();
  process.env.VOICE_V2_ASTRA_INTERPRETER = "1";
  setVoiceV2TestAstraMode("success", {
    successMeaning: (ctx) => ({
      active_goal: "BOOK_APPOINTMENT",
      facts: {
        requested_date: "2026-09-25",
        requested_daypart: "morning",
        requested_time: null,
        selected_slot_spoken_label: null,
        selected_slot_ordinal: null,
        selected_slot_id: null,
      },
      corrections: [],
      explicit_action_requests: ["BOOK_APPOINTMENT"],
      ambiguities: [],
      confidence: 0.92,
      digression: false,
      evidence: ctx.stable.text,
      literal_intake_fields: { name: "Astra User", email: "astra@example.com" },
    }),
  });
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_ASTRA_OK" });
  const ev = await h.speak("book me Friday morning I'm Astra User astra at example dot com");
  process.env.VOICE_V2_ASTRA_INTERPRETER = "0";
  setVoiceV2TestAstraMode(null);
  if (ev.terminal !== "interpreted") {
    fail(`ingress_astra_ok: expected interpreted, got ${ev.terminal}`);
  } else {
    pass("Astra mock success → interpreted terminal");
  }
  h.dispose();
}

async function testAstraMockTimeoutFallback() {
  resetSemanticIngressTestWorld();
  process.env.VOICE_V2_ASTRA_INTERPRETER = "1";
  setVoiceV2TestAstraMode("timeout", { timeoutMs: 30 });
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_ASTRA_TO" });
  await h.speak("Anthony Johnson");
  await h.speak("anthony@example.com");
  const before = JSON.stringify(h.orchestration.controlPlane.getCallContext()?.intakeState ?? {});
  const ev = await h.speak("I need September 25th in the morning");
  process.env.VOICE_V2_ASTRA_INTERPRETER = "0";
  setVoiceV2TestAstraMode(null);
  if (ev.terminal !== "interpreted") {
    fail(`ingress_astra_timeout: expected interpreted via preserve/fallback, got ${ev.terminal}`);
  }
  const after = JSON.stringify(h.orchestration.controlPlane.getCallContext()?.intakeState ?? {});
  if (before !== after) {
    fail("ingress_astra_timeout: intake should be unchanged when Astra times out on scheduling utterance");
  } else {
    pass("Astra timeout → interpreted terminal (no silent drop)");
  }
  h.dispose();
}

async function testAstraMockFailPreserveState() {
  resetSemanticIngressTestWorld();
  process.env.VOICE_V2_ASTRA_INTERPRETER = "1";
  setVoiceV2TestAstraMode("fail");
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_ASTRA_FAIL" });
  await h.speak("Anthony Johnson anthony@example.com");
  const ev = await h.speak("September 25th morning please");
  process.env.VOICE_V2_ASTRA_INTERPRETER = "0";
  setVoiceV2TestAstraMode(null);
  if (ev.terminal !== "interpreted") {
    fail(`ingress_astra_fail: expected interpreted, got ${ev.terminal}`);
  } else {
    pass("Astra fail → safe fallback → interpreted");
  }
  h.dispose();
}

async function testEveryUtteranceHasTerminal() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_TERMINAL" });
  await h.speak("hello");
  await h.speak("September 25th please");
  for (const ev of h.events) {
    const ok = ["interpreted", "superseded", "failed", "rejected", "queued"].includes(ev.terminal);
    if (!ok) {
      fail(`ingress_terminal: missing terminal for ${ev.utterance_id}`);
    }
  }
  const nonQueued = h.events.filter((e) => e.terminal !== "queued");
  if (nonQueued.length < 2) {
    fail("ingress_terminal: expected interpreted events");
  } else {
    pass("every stable utterance records explicit terminal");
  }
  h.dispose();
}

async function testNoSilentDropOnEmpty() {
  resetSemanticIngressTestWorld();
  const h = new VoiceV2SemanticIngressHarness({ callId: "INGRESS_EMPTY" });
  h.markControlPlaneReady("test");
  const r = await syncLiveCallerUtteranceIntent({
    claims: {
      workspaceId: "ws_test",
      agentId: "agent_test",
      callId: h.orchestration.callId,
      callControlId: h.orchestration.callControlId,
    },
    callerUtterance: "   ",
    fullConversationTranscript: "",
    controlPlane: h.orchestration.controlPlane,
    sendLiveOut: () => {},
    dispatchContext: h.orchestration.dispatch,
  });
  if (r.terminal !== "rejected") {
    fail(`ingress_empty: expected rejected, got ${r.terminal}`);
  } else {
    pass("empty utterance → VOICE_STABLE_UTTERANCE_REJECTED");
  }
  h.dispose();
}

async function main() {
  console.info("=== Voice V2 semantic ingress e2e (production path) ===\n");
  await testAppointmentBeforeControlPlaneReady();
  await testDateBeforeIntakeViaSpeech();
  await testSplitEmailUtterance();
  await testSplitEmailSpokenAt();
  await testCorrectionFridayThursday();
  await testConcurrentCalls();
  await testRevisionSuperseded();
  await testInterpreterDeterministicSuccess();
  await testAstraMockSuccess();
  await testAstraMockTimeoutFallback();
  await testAstraMockFailPreserveState();
  await testEveryUtteranceHasTerminal();
  await testFullChainToBookingConfirmed();
  await testNoSilentDropOnEmpty();

  if (failures > 0) {
    console.error(`\n${failures} ingress scenario(s) FAILED`);
    process.exit(1);
  }
  console.info("\nAll semantic ingress scenarios PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
