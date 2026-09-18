/**
 * Voice V3 semantic transport tests (no Live network required).
 */
import assert from "node:assert/strict";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import {
  decodeCallerMeaningFromFunctionArguments,
  decodeDelegatedCallerMeaning,
  validateCallerMeaningFromRaw,
} from "../src/lib/voice-v3/intake/decode-delegated-caller-meaning";
import {
  assertLiveDelegationAcceptPayloadCompatible,
  buildVoiceV3AstraDelegationResponses,
  voiceV3CallerMeaningTextFormat,
} from "../src/lib/voice-v3/intake/delegation-config";
import {
  buildEmitCallerMeaningLiveFunctionTool,
  EMIT_CALLER_MEANING_TOOL_NAME,
} from "../src/lib/voice-v3/intake/emit-caller-meaning-tool";
import { extractCallerMeaningFromAstraResponseEvent } from "../src/lib/voice-v3/intake/parse-astra-meaning-response";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
  getVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

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

function meaning(partial: Partial<CallerMeaning> & Pick<CallerMeaning, "captured_fields">): CallerMeaning {
  return {
    active_goal: partial.active_goal ?? "GENERAL",
    captured_fields: partial.captured_fields,
    scheduling: partial.scheduling ?? emptySchedulingMeaning(),
    corrections: partial.corrections ?? [],
    ambiguities: partial.ambiguities ?? [],
  };
}

function main() {
  const prevTransport = process.env.VOICE_V3_INTAKE_TRANSPORT;
  delete process.env.VOICE_V3_INTAKE_TRANSPORT;

  const accept = buildBasicLiveSessionAcceptParams();
  const responses =
    accept.session.delegation?.type === "responses"
      ? accept.session.delegation.responses
      : null;
  assert.ok(responses);
  assertLiveDelegationAcceptPayloadCompatible(responses);
  const serialized = JSON.stringify(responses);
  assert.equal(serialized.includes('"format"'), false);
  assert.equal((responses.text as { format?: unknown })?.format, undefined);

  const emitTool = responses.tools?.find(
    (t) => t && typeof t === "object" && t.name === EMIT_CALLER_MEANING_TOOL_NAME,
  );
  assert.ok(emitTool, "default transport must register emit_caller_meaning");
  assert.equal(emitTool?.strict, true);
  assert.deepEqual(responses.tool_choice, {
    type: "function",
    name: EMIT_CALLER_MEANING_TOOL_NAME,
  });

  const liveTool = buildEmitCallerMeaningLiveFunctionTool(TEST_AGENT_CONFIG);
  const format = voiceV3CallerMeaningTextFormat(TEST_AGENT_CONFIG) as {
    schema?: { properties?: { captured_fields?: { items?: { properties?: { key?: { enum?: string[] } } } } } };
  };
  const keyEnum = format.schema?.properties?.captured_fields?.items?.properties?.key?.enum;
  assert.ok(Array.isArray(keyEnum));
  const params = liveTool.parameters as {
    properties?: { captured_fields?: { items?: { properties?: { key?: { enum?: string[] } } } } };
  };
  const toolKeyEnum = params.properties?.captured_fields?.items?.properties?.key?.enum;
  assert.deepEqual(toolKeyEnum?.sort(), keyEnum.sort());

  const argsPayload = basePayload({
    captured_fields: [{ key: "name", value: "Anthony", confidence: 0.95 }],
    scheduling: {
      ...emptySchedulingMeaning(),
      date_relation: "NEXT_WEEKDAY",
      weekday: "FRIDAY",
      time_kind: "DAYPART",
      daypart: "AFTERNOON",
      date_expression: "next Friday",
      time_expression: "afternoon",
    },
  });
  const argsJson = JSON.stringify(argsPayload);
  const fromFn = decodeCallerMeaningFromFunctionArguments(argsJson, TEST_AGENT_CONFIG);
  assert.ok(fromFn);
  assert.equal(fromFn!.scheduling.weekday, "FRIDAY");

  const nestedCompleted = {
    type: "response.completed",
    response: {
      output: [
        {
          type: "function_call",
          name: EMIT_CALLER_MEANING_TOOL_NAME,
          call_id: "call_test",
          arguments: argsJson,
        },
      ],
    },
  };
  const extracted = extractCallerMeaningFromAstraResponseEvent(nestedCompleted, TEST_AGENT_CONFIG);
  assert.ok(extracted);
  assert.equal(extracted!.transport, "function_tool");
  assert.equal(extracted!.meaning.captured_fields[0]?.value, "Anthony");

  const malformed = validateCallerMeaningFromRaw(
    { ...basePayload(), active_goal: "NOT_VALID" },
    TEST_AGENT_CONFIG,
  );
  assert.equal(malformed.ok, false);

  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({ liveSessionId: "live_transport", callId: "call_t" });
  const versionBefore = runtime.getSnapshot().runtime.version;
  const bad = decodeCallerMeaningFromFunctionArguments(
    JSON.stringify(basePayload({ captured_fields: [{ key: "not_a_key", value: "x", confidence: 1 }] })),
    TEST_AGENT_CONFIG,
  );
  assert.equal(bad, null);
  assert.equal(runtime.getSnapshot().runtime.version, versionBefore);

  runtime.applyEvent({
    type: "CALLER_MEANING_APPLIED",
    meaning: meaning({ captured_fields: [{ key: "name", value: "A", confidence: 1 }] }),
  });
  assert.equal(runtime.getSnapshot().intake.values.name?.value, "A");

  clearVoiceV3CallRuntimeStore();
  const runtimeA = createVoiceV3CallRuntime({ liveSessionId: "iso_a", callId: "a" });
  const runtimeB = createVoiceV3CallRuntime({ liveSessionId: "iso_b", callId: "b" });
  runtimeA.applyEvent({
    type: "CALLER_MEANING_APPLIED",
    meaning: meaning({ captured_fields: [{ key: "name", value: "Alice", confidence: 1 }] }),
  });
  runtimeB.applyEvent({
    type: "CALLER_MEANING_APPLIED",
    meaning: meaning({ captured_fields: [{ key: "name", value: "Bob", confidence: 1 }] }),
  });
  assert.equal(getVoiceV3CallRuntime("iso_a")!.getSnapshot().intake.values.name?.value, "Alice");
  assert.equal(getVoiceV3CallRuntime("iso_b")!.getSnapshot().intake.values.name?.value, "Bob");

  process.env.VOICE_V3_INTAKE_TRANSPORT = "output_text";
  const textDelegation = buildVoiceV3AstraDelegationResponses("test", TEST_AGENT_CONFIG);
  assert.equal(textDelegation.tools?.length ?? 0, 0);
  const textMeaning = decodeDelegatedCallerMeaning(
    JSON.stringify(basePayload({ captured_fields: [{ key: "email", value: "a@b.co", confidence: 1 }] })),
    TEST_AGENT_CONFIG,
  );
  assert.ok(textMeaning);

  if (prevTransport !== undefined) {
    process.env.VOICE_V3_INTAKE_TRANSPORT = prevTransport;
  } else {
    delete process.env.VOICE_V3_INTAKE_TRANSPORT;
  }

  console.log("PASS voice-v3 intake transport");
}

main();
