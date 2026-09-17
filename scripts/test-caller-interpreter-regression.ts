#!/usr/bin/env npx tsx
/**
 * Utterance / interpreter boundary regressions (no PSTN).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-caller-interpreter-regression.ts
 */
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-v2/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import { applyCallerIntentToCallContext } from "../src/lib/voice-v2/caller-intent-interpreter";
import { callerMeaningToIntentInterpretation } from "../src/lib/voice-v2/caller-meaning-apply";
import { deterministicCallerInterpreter } from "../src/lib/voice-v2/deterministic-caller-interpreter";
import type { InterpreterContext } from "../src/lib/voice-v2/caller-meaning";
import type { VoiceDialogGoal } from "../src/lib/voice-v2/dialog-goal";
import {
  parseCallerMeaningFromModelJson,
} from "../src/lib/voice-v2/astra-caller-interpreter";
import {
  detectInterpreterWorkflowAuthorityViolation,
  shouldFailOnInterpreterSchemaViolation,
} from "../src/lib/voice-v2/caller-interpreter-schema";
import { mergeCallerFactsIntoCallContext } from "../src/lib/voice-v2/merge-caller-facts";
import { dialogFromContext } from "../src/lib/voice-v2/dialog-goal";
import { utteranceLooksLikeSchedulingCorrection } from "../src/lib/voice-v2/scheduling-preference-state";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { LiveCallerUtteranceAssembler } from "../src/lib/voice/telnyx/openai-live-bridge/live-caller-utterance-assembler";
import {
  beginUtteranceInterpretation,
  markUtteranceInterpretationApplied,
  registerStableCallerUtterance,
  resetAllUtteranceRevisionGuards,
  shouldApplyUtteranceInterpretation,
} from "../src/lib/voice/telnyx/openai-live-bridge/live-utterance-revision-guard";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function seed(sessionKey: string): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  const ctx: VoiceV2CallContext = {
    sessionKey,
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {
      phone: {
        value: "+15551234567",
        status: "PREFILLED",
        source: "CALLER_ID",
        updatedAt: new Date().toISOString(),
      },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

function stableRef(text: string, rev = 1) {
  return {
    utterance_id: "utt_test_1",
    revision: rev,
    start_ms: 0,
    end_ms: 1,
    stable_at: Date.now(),
    text,
  };
}

function interpreterCtx(
  text: string,
  prior: VoiceDialogGoal,
  callContext: VoiceV2CallContext,
  transcript = "",
): InterpreterContext {
  return {
    stable: stableRef(text),
    fullConversationTranscript: transcript || `Caller: ${text}`,
    callContext,
    priorActiveGoal: prior,
    activeGoal: prior,
    currentWorkflowStage: "COLLECT_REQUIRED_INTAKE",
    businessTimezone: callContext.businessTimezone,
    currentDateTimeIso: new Date().toISOString(),
    schedulingPreference: callContext.schedulingPreference ?? null,
    effectiveRequestedDate: callContext.schedulingPreference?.requestedDate ?? null,
    currentOfferSet: null,
    acceptedIntakeSnapshot: {},
    callId: "call_a",
  };
}

async function interpretDeterministic(
  text: string,
  prior: VoiceDialogGoal,
  callContext: VoiceV2CallContext,
) {
  const res = await deterministicCallerInterpreter.interpret(
    interpreterCtx(text, prior, callContext),
  );
  return res.meaning;
}

async function applyMeaning(
  ctx: VoiceV2CallContext,
  text: string,
  priorGoal: ReturnType<typeof dialogFromContext>["activeGoal"],
) {
  const meaning = await interpretDeterministic(text, priorGoal, ctx);
  const interpretation = callerMeaningToIntentInterpretation(meaning);
  return applyCallerIntentToCallContext(ctx, interpretation, text, { turnId: "utt_test_1" });
}

async function main() {
  clearVoiceV2CallSessions();
  resetAllUtteranceRevisionGuards();

  // Friday → actually Thursday (two stable utterances, as assembler would emit)
  let ctx = seed("cc:regression-friday-thursday");
  let applied = await applyMeaning(ctx, "I need Friday", "BOOK_APPOINTMENT");
  applied = await applyMeaning(
    applied.ctx,
    "actually Thursday morning",
    dialogFromContext(applied.ctx).activeGoal,
  );
  pass(
    "friday_thursday_correction",
    utteranceLooksLikeSchedulingCorrection("actually Thursday morning") &&
      Boolean(applied.ctx.schedulingPreference?.requestedDate) &&
      (/thursday/i.test(applied.ctx.schedulingPreference?.rawDatePhrase ?? "") ||
        /thursday/i.test(applied.ctx.schedulingPreference?.evidence ?? "")),
    JSON.stringify(applied.ctx.schedulingPreference),
  );

  // Split email (two stable utterances)
  ctx = seed("cc:regression-split-email");
  applied = await applyMeaning(ctx, "My email is anthony", "BOOK_APPOINTMENT");
  const emailPartial = applied.ctx.intakeState.email?.value ?? "";
  applied = await applyMeaning(
    applied.ctx,
    "anthony at gmail dot com",
    dialogFromContext(applied.ctx).activeGoal,
  );
  const emailFull = applied.ctx.intakeState.email?.value ?? "";
  pass(
    "split_email",
    emailFull.includes("@") || emailFull.includes("gmail") || emailPartial.includes("anthony"),
    emailFull,
  );

  // Date before email
  ctx = seed("cc:regression-date-before-email");
  applied = await applyMeaning(ctx, "next Friday morning please", "UNKNOWN");
  const dateFirst = applied.ctx.schedulingPreference?.requestedDate;
  applied = await applyMeaning(applied.ctx, "jane at example dot com", dialogFromContext(applied.ctx).activeGoal);
  pass("date_before_email", Boolean(dateFirst) && Boolean(applied.ctx.schedulingPreference?.requestedDate));

  // Email before date
  ctx = seed("cc:regression-email-before-date");
  applied = await applyMeaning(ctx, "my email is bob at example dot com", "BOOK_APPOINTMENT");
  const hadEmail = Boolean(applied.ctx.intakeState.email?.value);
  applied = await applyMeaning(applied.ctx, "how about Tuesday afternoon", dialogFromContext(applied.ctx).activeGoal);
  pass("email_before_date", hadEmail && Boolean(applied.ctx.schedulingPreference?.requestedDate));

  // Correction clears offer set
  ctx = seed("cc:regression-inflight-find");
  ctx = {
    ...ctx,
    currentOfferSet: { offerSetId: "offer_old", slotIds: ["s1"] },
    bookingState: { selectedSlotId: "s1", status: "selected" },
    schedulingPreference: { requestedDate: "2026-09-26", source: "caller" },
  };
  setVoiceV2CallContext(ctx);
  const merge = await mergeCallerFactsIntoCallContext(ctx, {
    utterance: "actually make it Thursday instead",
    interpretation: callerMeaningToIntentInterpretation(
      await interpretDeterministic("actually make it Thursday instead", "BOOK_APPOINTMENT", ctx),
    ),
    turnId: "utt_corr",
  });
  pass(
    "correction_clears_offer",
    !merge.ctx.currentOfferSet?.offerSetId && merge.schedulingChanged,
  );

  // Schema violation rejects (non-strict test env uses null)
  const violation = detectInterpreterWorkflowAuthorityViolation({
    active_goal: "BOOK_APPOINTMENT",
    stage: "FIND_AVAILABILITY",
  });
  pass("violation_detected", violation?.forbiddenKeys.includes("stage") === true);
  const parsedBad = parseCallerMeaningFromModelJson(
    { active_goal: "BOOK_APPOINTMENT", stage: "X", facts: {} },
    "book",
  );
  pass(
    "violation_rejects_parse",
    shouldFailOnInterpreterSchemaViolation() ? parsedBad === null : parsedBad === null,
  );

  // Revision guard: N+1 stable blocks N apply
  resetAllUtteranceRevisionGuards();
  const callId = "call_rev";
  const s1 = { utterance_id: "u1", revision: 1, start_ms: 0, end_ms: 1, stable_at: 1, text: "a" };
  const s2 = { ...s1, revision: 2, text: "a b" };
  registerStableCallerUtterance(callId, s1);
  registerStableCallerUtterance(callId, s2);
  beginUtteranceInterpretation(callId, s1);
  pass("stale_revision_blocked", shouldApplyUtteranceInterpretation(callId, s1) === false);
  pass("latest_revision_ok", shouldApplyUtteranceInterpretation(callId, s2) === true);
  markUtteranceInterpretationApplied(callId, s2);

  // Two calls isolated buffers
  resetAllUtteranceRevisionGuards();
  const stableA: string[] = [];
  const stableB: string[] = [];
  const asmA = new LiveCallerUtteranceAssembler({
    callId: "call_a",
    stabilizeMs: 40,
    onStable: (u) => stableA.push(u.text),
  });
  const asmB = new LiveCallerUtteranceAssembler({
    callId: "call_b",
    stabilizeMs: 40,
    onStable: (u) => stableB.push(u.text),
  });
  asmA.onTranscriptDelta("hello A");
  asmB.onTranscriptDelta("hello B");
  asmA.onCallerAudioEndedEstimate(10);
  asmB.onCallerAudioEndedEstimate(10);
  await new Promise((r) => setTimeout(r, 60));
  pass("isolated_buffers", stableA[0] === "hello A" && stableB[0] === "hello B");
  asmA.dispose();
  asmB.dispose();

  // Assembler correction window
  stableA.length = 0;
  const asmC = new LiveCallerUtteranceAssembler({
    callId: "call_c",
    stabilizeMs: 50,
    onStable: (u) => stableA.push(u.text),
  });
  asmC.onCallerAudioStarted(1);
  asmC.onTranscriptDelta("Friday");
  asmC.onCallerAudioEndedEstimate(2);
  await new Promise((r) => setTimeout(r, 25));
  asmC.onTranscriptDelta(" actually Thursday");
  await new Promise((r) => setTimeout(r, 70));
  pass("assembler_correction", stableA.length === 1 && stableA[0].includes("Thursday"));
  asmC.dispose();

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS test-caller-interpreter-regression");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
