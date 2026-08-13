/**
 * Field validation + phone resolution for receptionist runtime.
 *
 * Run: npx tsx scripts/test-receptionist-field-validation.ts
 */
import assert from "node:assert/strict";
import {
  isReceptionistFieldPlaceholder,
  resolveReceptionistCallbackPhone,
  validateReceptionistFieldValue,
} from "../src/lib/voice/receptionist/field-validation";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";

const phoneField: AgentFieldDefinition = {
  id: "phone",
  label: "Phone number",
  question: "What's your phone?",
  type: "phone",
  required: true,
  askWhen: "every_caller",
};

const nameField: AgentFieldDefinition = {
  id: "name",
  label: "Full name",
  question: "Your name?",
  type: "text",
  required: true,
  askWhen: "every_caller",
};

assert.equal(
  isReceptionistFieldPlaceholder("(no number provided in transcription)"),
  true,
);
assert.equal(isReceptionistFieldPlaceholder("571-477-6175"), false);

assert.throws(
  () => validateReceptionistFieldValue(phoneField, "(no number provided in transcription)"),
  /phone number/i,
);
assert.equal(
  validateReceptionistFieldValue(phoneField, "571-477-6175"),
  "+15714776175",
);

assert.throws(() => validateReceptionistFieldValue(nameField, "x"), /full name/i);
assert.equal(validateReceptionistFieldValue(nameField, "Benny Johnson"), "Benny Johnson");

assert.equal(
  resolveReceptionistCallbackPhone({
    collectedPhone: "(no number provided in transcription)",
    callerE164: "+15714776175",
  }),
  "+15714776175",
);
assert.equal(
  resolveReceptionistCallbackPhone({
    collectedPhone: "571-477-6175",
    callerE164: "+19998887777",
  }),
  "+15714776175",
);

console.log("test-receptionist-field-validation: ok");
