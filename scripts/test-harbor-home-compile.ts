import assert from "node:assert/strict";
import {
  buildHarborHomeAdvancedSettings,
  HARBOR_HOME_CAPABILITIES,
  HARBOR_HOME_WIZARD_CONTENT,
} from "../src/lib/receptionist-wizard/harbor-home-demo-config";
import { compileReceptionistConfig } from "../src/lib/voice/receptionist/compile";
import { RECEPTIONIST_ADVANCED_KEY } from "../src/lib/receptionist-wizard/advanced-types";
import { collectFieldIdsFromRows } from "../src/lib/voice/receptionist/field-manifest";

const advanced = buildHarborHomeAdvancedSettings();
const snapshot = compileReceptionistConfig({
  agentName: HARBOR_HOME_WIZARD_CONTENT.agentName,
  businessName: HARBOR_HOME_WIZARD_CONTENT.businessName,
  businessDescription: HARBOR_HOME_WIZARD_CONTENT.businessDescription,
  agentJobInstructions: HARBOR_HOME_WIZARD_CONTENT.agentJobInstructions,
  agentPersonalityNotes: HARBOR_HOME_WIZARD_CONTENT.agentPersonalityNotes,
  industry: HARBOR_HOME_WIZARD_CONTENT.industry,
  additionalInstructions: HARBOR_HOME_WIZARD_CONTENT.additionalInstructions,
  greeting: HARBOR_HOME_WIZARD_CONTENT.greeting,
  language: "en-US",
  timezone: "America/New_York",
  answerTiming: "every_call",
  capabilities: HARBOR_HOME_CAPABILITIES,
  collectFields: collectFieldIdsFromRows(advanced.callerFields),
  voiceId: "cgSgspJ2msm6clMCkdW9",
  advanced: {
    [RECEPTIONIST_ADVANCED_KEY]: advanced,
    receptionistWizard: {
      ...HARBOR_HOME_WIZARD_CONTENT,
      businessHours: HARBOR_HOME_WIZARD_CONTENT.businessHours,
      serviceArea: HARBOR_HOME_WIZARD_CONTENT.serviceArea,
      coreServices: HARBOR_HOME_WIZARD_CONTENT.coreServices,
      pricingNotes: HARBOR_HOME_WIZARD_CONTENT.pricingNotes,
      importantFacts: HARBOR_HOME_WIZARD_CONTENT.importantFacts,
      businessAddress: HARBOR_HOME_WIZARD_CONTENT.businessAddress,
    },
  },
});

const prompt = snapshot.compiledPrompt;
assert.ok(prompt.includes("YOUR JOB"));
assert.ok(prompt.includes("ADDITIONAL CUSTOMER INSTRUCTIONS"));
assert.ok(prompt.includes("Harbor Home HVAC"));
assert.ok(prompt.includes("Monday–Friday"));
assert.ok(prompt.toLowerCase().includes("same-day emergency"));

const ids = snapshot.fieldManifest.map((f) => f.id);
assert.ok(ids.includes("name"));
assert.ok(ids.includes("phone"));
assert.ok(ids.includes("reason"));
assert.ok(ids.includes("address"));
assert.ok(ids.includes("custom_issue_category"));
assert.ok(ids.includes("custom_system_type"));
assert.ok(ids.includes("custom_access_notes"));

const issueField = snapshot.fieldManifest.find((f) => f.id === "custom_issue_category");
assert.ok(issueField?.question?.includes("no-heat"));

assert.ok(snapshot.capabilities.includes("send_text"));
assert.equal(advanced.transferPolicy.destinationE164, "+17038166017");

console.log("test-harbor-home-compile: ok");
