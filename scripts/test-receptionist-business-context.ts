import assert from "node:assert/strict";
import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { buildReceptionistCompiledPrompt } from "../src/lib/voice/receptionist/build-receptionist-compiled-prompt";
import { TRANSOVO_RECEPTIONIST_CONSTITUTION } from "../src/lib/voice/receptionist/transovo-receptionist-constitution";

const snapshot = compileReceptionistConfig({
  agentName: "Sarah",
  businessName: "Summit Electric Services",
  businessDescription:
    "Summit Electric Services is a residential and commercial electrical contractor serving Northern Virginia.",
  agentJobInstructions:
    "Answer incoming calls. For service requests, collect name, callback number, service address, and problem. Do not quote repair prices other than the service-call fee.",
  greeting: "Hi, thanks for calling Summit Electric.",
  language: "en-US",
  timezone: "America/New_York",
  answerTiming: "every_call",
  capabilities: ["answer_questions", "take_messages", "collect_info"],
  collectFields: ["name", "phone", "reason"],
  voiceId: "cgSgspJ2msm6clMCkdW9",
  advanced: {
    receptionistWizard: {
      businessHours: "Monday-Friday: 8 AM-6 PM\nSaturday: 9 AM-2 PM\nSunday: Closed",
      serviceArea: "Woodbridge, Dale City, Lake Ridge, Stafford and surrounding areas",
      coreServices:
        "Electrical repairs\nBreaker panel inspections\nEV charger installation\nEmergency electrical service",
      pricingNotes: "Standard service-call fee is $89.",
    },
  },
});

assert.ok(snapshot.compiledPrompt.includes("TRANSOVO RECEPTIONIST RULES"));
assert.ok(snapshot.compiledPrompt.includes("YOUR JOB"));
assert.ok(snapshot.compiledPrompt.includes("BUSINESS"));
assert.ok(snapshot.compiledPrompt.includes("CALL CONFIGURATION"));
assert.ok(snapshot.compiledPrompt.includes("Summit Electric Services"));
assert.ok(snapshot.compiledPrompt.includes("Monday-Friday"));
assert.ok(snapshot.compiledPrompt.includes("EV charger"));
assert.ok(snapshot.compiledPrompt.includes("Do not quote repair prices"));
assert.equal(snapshot.compiledPrompt, snapshot.businessContext);

const prompt = buildReceptionistCompiledPrompt(snapshot);
assert.ok(prompt.startsWith(TRANSOVO_RECEPTIONIST_CONSTITUTION.slice(0, 20)));

console.log("test-receptionist-business-context: ok");
