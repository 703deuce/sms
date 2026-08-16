import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { getReceptionistCompiledFromAdvanced } from "../src/lib/voice/receptionist/runtime";
import { RECEPTIONIST_COMPILED_KEY } from "../src/lib/voice/receptionist/types";
import { createDefaultAdvancedSettings } from "../src/lib/receptionist-wizard/advanced-defaults";
import assert from "node:assert";

const snapshot = compileReceptionistConfig({
  agentName: "Amy",
  businessName: "John's Plumbing",
  businessDescription: "Plumbing services in London",
  greeting: "Hi, thanks for calling John's Plumbing.",
  language: "en-US",
  answerTiming: "every_call",
  capabilities: ["answer_questions", "take_messages", "collect_info"],
  collectFields: ["name", "phone", "reason"],
  voiceId: "marin",
});

assert.equal(snapshot.livekitProfile, "frontdesk_realtime");
assert.equal(snapshot.businessName, "John's Plumbing");
assert.equal(snapshot.realtimeModel, "gpt-realtime-2.1-mini");
assert.equal(snapshot.realtimeOutputMode, "elevenlabs");
assert.ok(snapshot.businessContext.includes("TRANSOVO SYSTEM"));
assert.ok(snapshot.businessContext.includes("YOUR JOB"));
assert.equal(snapshot.voiceId, "cgSgspJ2msm6clMCkdW9");
assert.equal(snapshot.fieldManifest.length, 3);
assert.ok(snapshot.enabledBuiltinTools.includes("get_business_answer"));
assert.ok(snapshot.enabledBuiltinTools.includes("take_message"));
assert.equal(RECEPTIONIST_COMPILED_KEY, "receptionistCompiled");

const fromAdvanced = getReceptionistCompiledFromAdvanced({
  [RECEPTIONIST_COMPILED_KEY]: snapshot,
});
assert.equal(fromAdvanced?.businessName, "John's Plumbing");

const advanced = createDefaultAdvancedSettings();
advanced.transferPolicy.destinationE164 = "+15551234567";
advanced.transferPolicy.emergencyDestinationE164 = "+15559110000";
advanced.actionPermissions.cancelAppointments = true;
advanced.actionPermissions.rescheduleAppointments = true;
advanced.callerFields = advanced.callerFields.map((row) =>
  row.id === "email" ? { ...row, enabled: true } : row,
);

const advancedSnapshot = compileReceptionistConfig({
  agentName: "Amy",
  businessName: "Test Co",
  businessDescription: "Test business",
  greeting: "Hello",
  language: "en-US",
  answerTiming: "every_call",
  capabilities: ["collect_info", "book_appointments", "transfer_calls"],
  collectFields: [],
  voiceId: "marin",
  advanced: { receptionistAdvanced: advanced },
});

assert.equal(
  (advancedSnapshot.transferPolicy as { destinationE164?: string }).destinationE164,
  "+15551234567",
);
assert.ok(advancedSnapshot.enabledBuiltinTools.includes("cancel_appointment"));
assert.ok(advancedSnapshot.enabledBuiltinTools.includes("reschedule_appointment"));
assert.equal(advancedSnapshot.fieldManifest.length, 4);
assert.ok(advancedSnapshot.fieldManifest.some((f) => f.id === "email"));

console.log("test-receptionist-compile: ok");
