import assert from "node:assert/strict";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import { voiceV3CallerMeaningTextFormat } from "../src/lib/voice-v3/intake/delegation-config";
import { CALLER_MEANING_STRUCTURED_OUTPUT_NAME } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
  getVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";

function meaning(partial: Partial<CallerMeaning> & Pick<CallerMeaning, "captured_fields">): CallerMeaning {
  return {
    active_goal: partial.active_goal ?? "GENERAL",
    captured_fields: partial.captured_fields,
    scheduling: partial.scheduling ?? emptySchedulingMeaning(),
    slot_selection: partial.slot_selection ?? emptySlotSelectionMeaning(),
    post_book_intent: partial.post_book_intent ?? "NONE",
    appointment_selection: partial.appointment_selection ?? { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: partial.cancellation_confirmation ?? "NONE",
    corrections: partial.corrections ?? [],
    ambiguities: partial.ambiguities ?? [],
  };
}

function apply(runtime: ReturnType<typeof createVoiceV3CallRuntime>, m: CallerMeaning) {
  runtime.applyEvent({ type: "CALLER_MEANING_APPLIED", meaning: m });
}

function main() {
  const accept = buildBasicLiveSessionAcceptParams();
  const responses =
    accept.session.delegation?.type === "responses"
      ? accept.session.delegation.responses
      : null;
  assert.ok(responses);
  const liveText = responses.text as { format?: unknown; verbosity?: string } | undefined;
  assert.equal(liveText?.format, undefined, "Live accept must not send text.format (API 400)");
  assert.equal(liveText?.verbosity, "low");

  const integrationFormat = voiceV3CallerMeaningTextFormat(TEST_AGENT_CONFIG) as {
    type?: string;
    name?: string;
  };
  assert.equal(integrationFormat.type, "json_schema");
  assert.equal(integrationFormat.name, CALLER_MEANING_STRUCTURED_OUTPUT_NAME);

  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: "live_seq_test",
    callId: "call_seq",
    config: TEST_AGENT_CONFIG,
  });

  apply(runtime, meaning({ captured_fields: [{ key: "name", value: "Anthony", confidence: 0.95 }] }));
  let ctx = runtime.getSnapshot();
  assert.equal(ctx.intake.values.name?.value, "Anthony");
  let rules = evaluateVoiceV3Rules(ctx, TEST_AGENT_CONFIG);
  assert.equal(rules.intakeComplete, false);
  assert.deepEqual(rules.missingRequiredFields.sort(), ["email", "mothers_name"].sort());

  apply(
    runtime,
    meaning({ captured_fields: [{ key: "email", value: "anthony@example.com", confidence: 0.9 }] }),
  );
  ctx = runtime.getSnapshot();
  rules = evaluateVoiceV3Rules(ctx, TEST_AGENT_CONFIG);
  assert.equal(rules.intakeComplete, false);

  apply(
    runtime,
    meaning({ captured_fields: [{ key: "mothers_name", value: "Mary", confidence: 0.92 }] }),
  );
  ctx = runtime.getSnapshot();
  rules = evaluateVoiceV3Rules(ctx, TEST_AGENT_CONFIG);
  assert.equal(rules.intakeComplete, true);

  apply(
    runtime,
    meaning({ captured_fields: [{ key: "favorite_dinosaur", value: "T-Rex", confidence: 0.88 }] }),
  );
  assert.equal(runtime.getSnapshot().intake.values.favorite_dinosaur?.value, "T-Rex");

  apply(
    runtime,
    meaning({
      corrections: [{ key: "mothers_name", new_value: "Maria", confidence: 0.97 }],
      captured_fields: [],
    }),
  );
  ctx = runtime.getSnapshot();
  assert.equal(ctx.intake.values.mothers_name?.value, "Maria");
  assert.equal(ctx.intake.values.name?.value, "Anthony");
  assert.equal(ctx.intake.values.email?.value, "anthony@example.com");
  assert.equal(ctx.intake.values.favorite_dinosaur?.value, "T-Rex");

  clearVoiceV3CallRuntimeStore();
  const runtimeA = createVoiceV3CallRuntime({ liveSessionId: "live_a", callId: "call_a" });
  const runtimeB = createVoiceV3CallRuntime({ liveSessionId: "live_b", callId: "call_b" });
  apply(
    runtimeA,
    meaning({
      captured_fields: [
        { key: "mothers_name", value: "Mary", confidence: 1 },
        { key: "favorite_dinosaur", value: "T-Rex", confidence: 1 },
      ],
    }),
  );
  apply(
    runtimeB,
    meaning({
      captured_fields: [
        { key: "mothers_name", value: "Susan", confidence: 1 },
        { key: "favorite_dinosaur", value: "Stegosaurus", confidence: 1 },
      ],
    }),
  );
  assert.equal(getVoiceV3CallRuntime("live_a")!.getSnapshot().intake.values.mothers_name?.value, "Mary");
  assert.equal(getVoiceV3CallRuntime("live_b")!.getSnapshot().intake.values.mothers_name?.value, "Susan");
  assert.equal(
    getVoiceV3CallRuntime("live_a")!.getSnapshot().intake.values.favorite_dinosaur?.value,
    "T-Rex",
  );
  assert.equal(
    getVoiceV3CallRuntime("live_b")!.getSnapshot().intake.values.favorite_dinosaur?.value,
    "Stegosaurus",
  );

  clearVoiceV3CallRuntimeStore();
  console.log("PASS voice-v3 intake deterministic sequence");
}

main();
