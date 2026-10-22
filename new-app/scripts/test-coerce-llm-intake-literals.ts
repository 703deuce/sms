#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  coerceOptionalToolPhoneArg,
  isLlmPlaceholderString,
} from "@/lib/server/voice-v3/intake-objective/coerce-llm-literal";
import { normalizeUpdateIntakeArguments } from "@/lib/server/voice-v3/intake-objective/build-intake-tool-schema";
import { validateAndNormalizeIntakeValue } from "@/lib/server/voice-v3/intake-objective/validate-intake-value";

assert.equal(isLlmPlaceholderString("null"), true);
assert.equal(isLlmPlaceholderString("}"), true);
assert.equal(coerceOptionalToolPhoneArg("}"), undefined);
assert.equal(coerceOptionalToolPhoneArg("571-477-6175"), "+15714776175");

const config = {
  intakeFields: [{ key: "i2", label: "Callback", type: "phone" as const, required: true, description: "" }],
} as import("@/lib/server/voice-v3/config/agent-config").VoiceV3AgentConfig;

const normalized = normalizeUpdateIntakeArguments(config, { i2: "null", i1: "Jane" });
assert.equal(normalized.i2, null);

const phone = validateAndNormalizeIntakeValue(config.intakeFields[0], "(571) 477-6175");
assert.equal(phone.ok && phone.value, "+15714776175");

console.log("test-coerce-llm-intake-literals: PASS");
