import assert from "node:assert/strict";
import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { TRANSOVO_RECEPTIONIST_CONSTITUTION } from "../src/lib/voice/receptionist/transovo-receptionist-constitution";
import { buildGeneratedWorkflowRules } from "../src/lib/voice/receptionist/build-generated-workflow-rules";

const snapshot = compileReceptionistConfig({
  agentName: "Sarah",
  businessName: "Summit Electric Services",
  businessDescription: "Residential and commercial electrical contractor in Northern Virginia.",
  agentJobInstructions:
    "Answer incoming calls. Collect name, phone, and service address for service requests.",
  greeting: "Hi, thanks for calling Summit Electric.",
  language: "en-US",
  timezone: "America/New_York",
  answerTiming: "every_call",
  capabilities: ["answer_questions", "take_messages", "collect_info", "book_appointments"],
  collectFields: ["name", "phone", "email"],
  voiceId: "cgSgspJ2msm6clMCkdW9",
  advanced: {
    receptionistWizard: {
      businessHours: "Monday-Friday: 8 AM-6 PM",
      serviceArea: "Northern Virginia",
      coreServices: "Panel upgrades\nEV charger installation",
    },
    bookingPolicy: { slotsToOffer: 3, confirmDateTimeVerbally: true },
  },
});

assert.ok(snapshot.compiledPrompt.startsWith(TRANSOVO_RECEPTIONIST_CONSTITUTION.slice(0, 16)));
assert.ok(snapshot.compiledPrompt.includes("TRANSOVO SYSTEM"));
assert.ok(snapshot.compiledPrompt.includes("YOUR JOB"));
assert.ok(snapshot.compiledPrompt.includes("BUSINESS"));
assert.ok(snapshot.compiledPrompt.includes("Summit Electric Services"));
assert.ok(snapshot.compiledPrompt.includes("Northern Virginia"));
assert.ok(snapshot.compiledPrompt.includes("EV charger"));
assert.ok(snapshot.compiledPrompt.includes("CALL CONFIGURATION"));
assert.ok(snapshot.compiledPrompt.includes("GENERATED WORKFLOW RULES"));

const pythonRules = buildGeneratedWorkflowRules(snapshot, "python");
assert.ok(pythonRules.includes("start_booking"));
assert.ok(pythonRules.includes("check_availability"));
assert.ok(pythonRules.includes("confirm_booking"));
assert.ok(!pythonRules.includes("schedule_appointment"));

const tsRules = buildGeneratedWorkflowRules(snapshot, "typescript");
assert.ok(tsRules.includes("schedule_appointment"));

console.log("test-receptionist-python-compiled-prompt: ok");
