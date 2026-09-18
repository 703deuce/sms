#!/usr/bin/env npx tsx
/**
 * Conversation-history + safe-fallback regressions (no live Astra).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-interpreter-context-regression.ts
 */
import { classifyInterpreterSafeFallback } from "../src/lib/voice-receptionist-wizard/interpreter-safe-fallback";
import type { InterpreterContext } from "../src/lib/voice-receptionist-wizard/caller-meaning";
import { resolveSlotIdFromOfferReference } from "../src/lib/voice-receptionist-wizard/resolve-slot-from-offer-ordinal";
import type { VoiceV2Slot } from "../src/lib/voice-receptionist-wizard/types";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function baseCtx(overrides: Partial<InterpreterContext>): InterpreterContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  const callContext: VoiceV2CallContext = {
    sessionKey: "cc:test",
    workspaceId: "ws",
    agentId: "ag",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    dialog: { activeGoal: "BOOK_APPOINTMENT", explicitCallbackRequested: false },
  };
  return {
    stable: {
      utterance_id: "utt_1",
      revision: 1,
      start_ms: 0,
      end_ms: 1,
      stable_at: 1,
      text: overrides.stable?.text ?? "",
    },
    fullConversationTranscript: overrides.fullConversationTranscript ?? "",
    callContext: overrides.callContext ?? callContext,
    priorActiveGoal: overrides.priorActiveGoal ?? "BOOK_APPOINTMENT",
    activeGoal: overrides.activeGoal ?? "BOOK_APPOINTMENT",
    currentWorkflowStage: overrides.currentWorkflowStage ?? "COLLECT_REQUIRED_INTAKE",
    businessTimezone: "America/Los_Angeles",
    currentDateTimeIso: new Date().toISOString(),
    schedulingPreference: overrides.schedulingPreference ?? null,
    effectiveRequestedDate: overrides.effectiveRequestedDate ?? null,
    currentOfferSet: overrides.currentOfferSet ?? null,
    acceptedIntakeSnapshot: overrides.acceptedIntakeSnapshot ?? {},
    callId: overrides.callId ?? "call_a",
    ...overrides,
  };
}

function slots(): VoiceV2Slot[] {
  return [
    { slot_id: "s9", label: "9:00 AM", spoken_label: "9 AM" },
    { slot_id: "s10", label: "10:00 AM", spoken_label: "10 AM" },
    { slot_id: "s11", label: "11:00 AM", spoken_label: "11 AM" },
  ];
}

function main() {
  const later = resolveSlotIdFromOfferReference(slots(), "the later one");
  pass("later_one_slot", later === "s11", later ?? "null");

  const first = resolveSlotIdFromOfferReference(slots(), "actually the first one");
  pass("first_one_slot", first === "s9", first ?? "null");

  const safeEmail = classifyInterpreterSafeFallback(
    baseCtx({
      stable: { utterance_id: "u", revision: 1, start_ms: 0, end_ms: 0, stable_at: 0, text: "my email is anthony@gmail.com" },
    }),
  );
  pass("safe_email", safeEmail.mergePolicy === "literal_facts_only");

  const preserveLater = classifyInterpreterSafeFallback(
    baseCtx({
      stable: { utterance_id: "u", revision: 1, start_ms: 0, end_ms: 0, stable_at: 0, text: "the later one" },
      fullConversationTranscript: "Amy: I have 9, 10, and 11.\nCaller: the later one",
      currentOfferSet: {
        offer_set_id: "o1",
        slot_ids: ["s9", "s10", "s11"],
        offered_slots: [
          { slot_id: "s9", sort_index: 1, label: "9 AM" },
          { slot_id: "s10", sort_index: 2, label: "10 AM" },
          { slot_id: "s11", sort_index: 3, label: "11 AM" },
        ],
      },
    }),
  );
  pass("ambiguous_later_preserve", preserveLater.mergePolicy === "none");

  const safeName = classifyInterpreterSafeFallback(
    baseCtx({
      stable: { utterance_id: "u", revision: 1, start_ms: 0, end_ms: 0, stable_at: 0, text: "My name is Anthony Johnson" },
    }),
  );
  pass("safe_name", safeName.mergePolicy === "literal_facts_only");

  const ctxA = baseCtx({
    callId: "call_a",
    stable: { utterance_id: "ua", revision: 1, start_ms: 0, end_ms: 0, stable_at: 0, text: "Friday" },
    fullConversationTranscript: "Caller: Friday",
  });
  const ctxB = baseCtx({
    callId: "call_b",
    stable: { utterance_id: "ub", revision: 1, start_ms: 0, end_ms: 0, stable_at: 0, text: "Thursday" },
    fullConversationTranscript: "Caller: Thursday",
  });
  pass("isolated_histories", ctxA.fullConversationTranscript !== ctxB.fullConversationTranscript);

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS test-interpreter-context-regression");
}

main();
