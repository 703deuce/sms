import assert from "node:assert";
import { createDefaultWizardState } from "../src/lib/receptionist-wizard/defaults";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
} from "../src/lib/voice/receptionist/compile";
import { recompileReceptionistFromDraft } from "../src/lib/voice/receptionist/recompile";
import {
  getLiveKitAgentTemplateFromAdvanced,
  LIVEKIT_AGENT_TEMPLATE_KEY,
} from "../src/lib/voice/templates/agent-template-config";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

const TEMPLATE = "livekit_frontdesk_booking";
const state = createDefaultWizardState();
state.livekitAgentTemplate = TEMPLATE;
state.capabilities = ["answer_questions", "book_appointments"];

const snapshot = compileReceptionistConfig({
  agentName: state.agentName,
  businessName: state.businessName,
  businessDescription: state.businessDescription,
  greeting: state.greeting,
  language: state.language,
  timezone: state.timezone,
  answerTiming: state.answerTiming,
  capabilities: state.capabilities,
  collectFields: state.collectFields,
  voiceId: state.voiceId,
  advanced: {
    receptionistWizard: state,
    livekitAgentTemplate: TEMPLATE,
  },
});

const draftConfig = applyCompiledToVoiceConfig(parseVoiceAgentConfig(null), snapshot, {
  receptionistWizard: state,
  livekitAgentTemplate: TEMPLATE,
});

const advanced = draftConfig.advanced as Record<string, unknown>;
assert.equal(advanced[LIVEKIT_AGENT_TEMPLATE_KEY], TEMPLATE);
assert.equal(
  getLiveKitAgentTemplateFromAdvanced(advanced),
  TEMPLATE,
  "template should resolve from draft advanced",
);

const republished = recompileReceptionistFromDraft(draftConfig);
const republishedAdvanced = republished.advanced as Record<string, unknown>;
assert.equal(republishedAdvanced[LIVEKIT_AGENT_TEMPLATE_KEY], TEMPLATE);
assert.equal(
  getLiveKitAgentTemplateFromAdvanced(republishedAdvanced),
  TEMPLATE,
  "template should survive publish recompile",
);
assert.ok(
  (republishedAdvanced.receptionistWizard as { livekitAgentTemplate?: string })
    ?.livekitAgentTemplate === TEMPLATE,
  "wizard should retain template selection",
);

console.log("test-agent-template-persistence: ok");
