import assert from "node:assert/strict";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { buildCallerMeaningZodSchema } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { voiceV3CallerMeaningTextFormat } from "../src/lib/voice-v3/intake/delegation-config";
import { resolveVoiceV3AgentConfig } from "../src/lib/voice-v3/state/call-runtime";

function intakeKeyEnumFromAccept(): string[] {
  const accept = buildBasicLiveSessionAcceptParams();
  const responses =
    accept.session.delegation?.type === "responses"
      ? accept.session.delegation.responses
      : null;
  assert.ok(responses);
  const format = voiceV3CallerMeaningTextFormat(VOICE_V3_BOOKING_AGENT_CONFIG) as {
    schema?: { properties?: { captured_fields?: { items?: { properties?: { key?: { enum?: string[] } } } } } };
  };
  const enumVals =
    format.schema?.properties?.captured_fields?.items?.properties?.key?.enum;
  assert.ok(Array.isArray(enumVals));
  return enumVals!.sort();
}

function main() {
  const runtimeConfig = resolveVoiceV3AgentConfig();
  assert.equal(runtimeConfig, VOICE_V3_BOOKING_AGENT_CONFIG);

  const keys = runtimeConfig.intakeFields.map((f) => f.key).sort();
  assert.deepEqual(keys, ["email", "name", "phone"]);
  assert.ok(!keys.includes("mothers_name"));
  assert.ok(!keys.includes("favorite_dinosaur"));

  buildCallerMeaningZodSchema(runtimeConfig).parse(
    {
      active_goal: "BOOK_APPOINTMENT",
      captured_fields: [{ key: "name", value: "A", confidence: 1 }],
      scheduling: {
        date_expression: null,
        date_relation: "UNSPECIFIED",
        weekday: null,
        explicit_date: null,
        time_expression: null,
        time_kind: "UNSPECIFIED",
        exact_time: null,
        start_time: null,
        end_time: null,
        daypart: null,
      },
      slot_selection: { selection_type: "NONE", spoken_time: null, ordinal: null },
      post_book_intent: "NONE",
      appointment_selection: { selection_type: "NONE", ordinal: null },
      cancellation_confirmation: "NONE",
      corrections: [],
      ambiguities: [],
    },
  );

  assert.deepEqual(intakeKeyEnumFromAccept(), keys);

  console.log("PASS voice-v3 pipeline config (booking-only runtime + Live accept schema)");
}

main();
