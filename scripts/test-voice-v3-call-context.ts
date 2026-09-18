import assert from "node:assert/strict";
import { createEmptyVoiceV3CallContext } from "../src/lib/voice-v3/call-context";
import {
  getVoiceV3IntakeReadiness,
  mergeIntakeExtractionIntoCallContext,
  parseVoiceV3IntakeExtraction,
} from "../src/lib/voice-v3/intake";
import {
  bumpAvailabilitySearchGeneration,
  isStaleAvailabilityResult,
  isStaleToolResult,
} from "../src/lib/voice-v3/rules/stale-result";

const business = {
  workspaceId: "ws_test",
  agentId: "agent_test",
  businessTimezone: "America/New_York",
  intakeFields: [
    { key: "name", label: "Name", requiredBeforeBooking: true, requiredForRecord: true },
    { key: "service_reason", label: "Reason", requiredBeforeBooking: false, requiredForRecord: true },
  ],
};

let ctx = createEmptyVoiceV3CallContext({
  sessionKey: "sk1",
  liveSessionId: "live_1",
  business,
});

const extraction = parseVoiceV3IntakeExtraction({
  field_updates: [
    { key: "name", value: "Jane Doe", status: "CAPTURED", evidence: "I'm Jane" },
    { key: "unknown_field", value: "x" },
  ],
  caller_intent: "book",
});

const merged = mergeIntakeExtractionIntoCallContext(ctx, extraction);
ctx = merged.context;

assert.equal(merged.appliedKeys.join(","), "name");
assert.equal(merged.ignoredKeys.join(","), "unknown_field");
assert.equal(merged.extractionGeneration, 1);
assert.equal(ctx.intakeState.name?.value, "Jane Doe");
assert.equal(ctx.intakeState.name?.source, "ASTRA_STRUCTURED");

const readiness = getVoiceV3IntakeReadiness(business, ctx.intakeState);
assert.deepEqual(readiness.missingBeforeBooking, []);
assert.deepEqual(readiness.missingForRecord, ["service_reason"]);

ctx = bumpAvailabilitySearchGeneration(ctx);
assert.equal(ctx.generations.availabilitySearch, 1);
assert.ok(isStaleAvailabilityResult(ctx, 0));
assert.ok(!isStaleAvailabilityResult(ctx, 1));

ctx = { ...ctx, generations: { ...ctx.generations, tool: 2 } };
assert.ok(isStaleToolResult(ctx, 1));
assert.ok(!isStaleToolResult(ctx, 2));

console.log("VOICE_V3_CALL_CONTEXT_TESTS_PASS");
