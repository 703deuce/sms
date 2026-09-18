import assert from "node:assert/strict";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import { buildCallerMeaningZodSchema } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { decodeDelegatedCallerMeaning } from "../src/lib/voice-v3/intake/decode-delegated-caller-meaning";
import { voiceV3CallerMeaningTextFormat } from "../src/lib/voice-v3/intake/delegation-config";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

const AGENT_A: VoiceV3AgentConfig = TEST_AGENT_CONFIG;

const AGENT_B: VoiceV3AgentConfig = {
  ...TEST_AGENT_CONFIG,
  businessName: "Agent B",
  intakeFields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "phone", label: "Phone", type: "phone", required: true },
    { key: "pet_name", label: "Pet", type: "text", required: false },
  ],
};

function json(obj: unknown): string {
  return JSON.stringify(obj);
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    active_goal: "GENERAL",
    captured_fields: [],
    scheduling: emptySchedulingMeaning(),
    corrections: [],
    ambiguities: [],
    ...overrides,
  };
}

function schemaKeyEnum(config: VoiceV3AgentConfig): string[] {
  const format = voiceV3CallerMeaningTextFormat(config) as {
    schema?: { properties?: { captured_fields?: { items?: { properties?: { key?: { enum?: string[] } } } } } };
  };
  const enumVals =
    format.schema?.properties?.captured_fields?.items?.properties?.key?.enum;
  assert.ok(Array.isArray(enumVals), "expected key enum in generated json_schema");
  return enumVals!;
}

function main() {
  const enumA = schemaKeyEnum(AGENT_A).sort();
  const enumB = schemaKeyEnum(AGENT_B).sort();
  assert.deepEqual(enumA, ["email", "favorite_dinosaur", "mothers_name", "name"].sort());
  assert.deepEqual(enumB, ["name", "pet_name", "phone"].sort());
  assert.equal(enumB.includes("mothers_name"), false);

  const rejectUnknown = decodeDelegatedCallerMeaning(
    json(
      basePayload({
        captured_fields: [{ key: "mothers_name", value: "x", confidence: 1 }],
      }),
    ),
    AGENT_B,
    { callId: "c1", liveSessionId: "live_b" },
  );
  assert.equal(rejectUnknown, null);

  const accepted = decodeDelegatedCallerMeaning(
    json(
      basePayload({
        captured_fields: [{ key: "name", value: "Anthony", confidence: 0.9 }],
      }),
    ),
    AGENT_A,
  );
  assert.ok(accepted);
  assert.equal(accepted!.captured_fields[0]?.value, "Anthony");

  const collapsed = decodeDelegatedCallerMeaning(
    json(
      basePayload({
        captured_fields: [
          { key: "name", value: "Anthony", confidence: 0.9 },
          { key: "name", value: "Anthony", confidence: 0.8 },
        ],
      }),
    ),
    AGENT_A,
  );
  assert.equal(collapsed?.captured_fields.length, 1);

  const conflict = decodeDelegatedCallerMeaning(
    json(
      basePayload({
        captured_fields: [
          { key: "name", value: "Anthony", confidence: 0.9 },
          { key: "name", value: "Tony", confidence: 0.8 },
        ],
      }),
    ),
    AGENT_A,
  );
  assert.equal(conflict?.captured_fields.length, 0);

  const clock = buildVoiceV3CallClock(AGENT_A.timezone);
  let ctx = createInitialVoiceV3CallContext({
    callId: "c1",
    liveSessionId: "live_1",
    timezone: AGENT_A.timezone,
    clock,
  });
  const withName = decodeDelegatedCallerMeaning(
    json(
      basePayload({
        captured_fields: [{ key: "name", value: "Anthony", confidence: 1 }],
      }),
    ),
    AGENT_A,
  )!;
  ctx = applyCallerMeaningToContext(ctx, AGENT_A, withName).context;
  const corrected = decodeDelegatedCallerMeaning(
    json(
      basePayload({
        captured_fields: [],
        corrections: [{ key: "name", new_value: "Tony", confidence: 1 }],
      }),
    ),
    AGENT_A,
  )!;
  ctx = applyCallerMeaningToContext(ctx, AGENT_A, corrected).context;
  assert.equal(ctx.intake.values.name?.value, "Tony");

  assert.equal(decodeDelegatedCallerMeaning("{not json", AGENT_A), null);
  assert.equal(
    decodeDelegatedCallerMeaning(json({ ...basePayload(), active_goal: "NOT_A_GOAL" }), AGENT_A),
    null,
  );
  assert.equal(
    decodeDelegatedCallerMeaning(
      json(
        basePayload({
          captured_fields: [{ key: "name", value: "A", confidence: 1 }],
          active_goal: "UNKNOWN",
        }),
      ),
      AGENT_A,
    )?.captured_fields.length,
    1,
  );

  const emptySignal = decodeDelegatedCallerMeaning(json(basePayload({ active_goal: "UNKNOWN" })), AGENT_A);
  assert.equal(emptySignal, null);

  buildCallerMeaningZodSchema(AGENT_A);
  console.log("PASS voice-v3 caller-meaning decoder regression");
}

main();
