#!/usr/bin/env npx tsx
/**
 * Voice V2 FAQ + large knowledge base (RAG) — headless certification.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-knowledge-headless.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { buildBusinessKnowledgePromptSection } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { workflowNodeExpectedTools } from "../src/lib/voice/telnyx/conversation-workflow";
import { buildDesiredTelnyxWorkflowPayload } from "../src/lib/voice/telnyx/workflow-sync";
import { resolveVoiceV2BookingStrategy } from "../src/lib/voice-v2/booking-strategy";
import {
  buildVoiceV2KnowledgeLayerBInstructions,
  isVoiceV2KnowledgeSearchEnabled,
  knowledgeConfigFromWizard,
  resolveVoiceV2KnowledgeConfig,
} from "../src/lib/voice-v2/knowledge-config";
import { executeVoiceV2SearchKnowledge } from "../src/lib/voice-v2/search-knowledge";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-v2/intake/compile-schema";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const KB_ID = "kb-test-headless-001";

function wizardWithKb(
  overrides: Partial<ReturnType<typeof createDefaultWizardState>> & {
    knowledgeBaseEnabled?: boolean | null;
  } = {},
) {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.knowledgeSource = "upload_docs";
  wizard.linkedKnowledgeBaseId = KB_ID;
  wizard.knowledgeBaseEnabled = overrides.knowledgeBaseEnabled ?? true;
  wizard.knowledgeItems = wizard.knowledgeItems.map((i) =>
    i.id === "hours"
      ? { ...i, summary: "Mon–Fri 9am–5pm", status: "complete", statusLabel: "Configured" }
      : i,
  );
  Object.assign(wizard, overrides);
  return wizard;
}

function configForStrategy(
  strategy: "NONE" | "REQUEST_ONLY" | "SEND_LINK" | "MICROSOFT_365" | "CALENDLY",
  kbEnabled = true,
): VoiceAgentConfig {
  const wizard = wizardWithKb({ knowledgeBaseEnabled: kbEnabled });
  wizard.bookingStrategy = strategy;
  wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments", "answer_questions"])];
  if (strategy === "SEND_LINK") {
    wizard.bookingLinkUrl = "https://book.example.com/schedule";
  } else if (strategy === "MICROSOFT_365") {
    wizard.calendarConnected = true;
    wizard.calendarProvider = "microsoft";
  } else if (strategy === "CALENDLY") {
    wizard.calendarConnected = true;
    wizard.calendarProvider = "calendly";
    wizard.calendlyEventTypeUri = "https://api.calendly.com/event_types/et-test";
  } else if (strategy === "NONE") {
    wizard.capabilities = wizard.capabilities.filter((c) => c !== "book_appointments");
    wizard.capabilities.push("take_messages");
  }
  const advanced = mergeAppointmentWizardAdvanced(wizard, { knowledgeBaseIds: [KB_ID] });
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      ...advanced,
      conversationWorkflowMode: true,
    },
    knowledgeBaseIds: [KB_ID],
  } as VoiceAgentConfig);
}

const v2Ids = {
  findId: "v2_find",
  bookId: "v2_book",
  saveIntakeId: "v2_save",
  finalizeRequestId: "v2_finalize",
  sendBookingLinkId: "v2_send",
  findExistingId: null,
  rescheduleId: null,
  cancelId: null,
  searchKnowledgeId: "v2_kb_search",
};

const baseShared = {
  sendResourceId: "st_send",
  searchDetailsId: "st_search",
  voiceAiBookingId: "st_legacy",
  hangupId: "st_hangup",
  transferId: "st_transfer",
};

// FAST FAQ — prompt injection, no KB tool when disabled
const faqWizard = wizardWithKb({ knowledgeBaseEnabled: false });
const faqBlock = buildBusinessKnowledgePromptSection(faqWizard);
assert.ok(faqBlock.includes("9am") || faqBlock.includes("9"), "hours in prompt knowledge");
const faqCfg = configForStrategy("REQUEST_ONLY", false);
assert.equal(isVoiceV2KnowledgeSearchEnabled(faqCfg), false);
assert.equal(buildVoiceV2KnowledgeLayerBInstructions(faqCfg), null);

// KB enabled — compile + workflow tool
const kbCfg = configForStrategy("MICROSOFT_365", true);
assert.equal(isVoiceV2KnowledgeSearchEnabled(kbCfg), true);
assert.ok(buildVoiceV2KnowledgeLayerBInstructions(kbCfg)?.includes("voice_v2_search_knowledge"));

buildDesiredTelnyxWorkflowPayload({
  shared: baseShared,
  v2Shared: v2Ids,
  config: kbCfg,
});
const msTools = workflowNodeExpectedTools("n_general", {
  voiceV2SaveIntake: v2Ids.saveIntakeId,
  voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  voiceV2Find: v2Ids.findId,
  voiceV2Book: v2Ids.bookId,
  voiceV2SearchKnowledge: v2Ids.searchKnowledgeId,
});
assert.ok(msTools.includes("voice_v2_search_knowledge"));
assert.ok(msTools.includes("voice_v2_find_availability"));

const msToolsKbOff = workflowNodeExpectedTools("n_general", {
  voiceV2SaveIntake: v2Ids.saveIntakeId,
  voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  voiceV2Find: v2Ids.findId,
  voiceV2Book: v2Ids.bookId,
  voiceV2SearchKnowledge: null,
});
assert.ok(!msToolsKbOff.includes("voice_v2_search_knowledge"));

// Toggle publish semantics
const offWizard = wizardWithKb({ knowledgeBaseEnabled: false });
const offAdvanced = mergeAppointmentWizardAdvanced(offWizard, { knowledgeBaseIds: [KB_ID] });
assert.equal(offAdvanced.knowledge?.knowledgeBaseEnabled, false);

const onWizard = wizardWithKb({ knowledgeBaseEnabled: true });
const onAdvanced = mergeAppointmentWizardAdvanced(onWizard, { knowledgeBaseIds: [KB_ID] });
assert.equal((onAdvanced.knowledge as { knowledgeBaseEnabled: boolean }).knowledgeBaseEnabled, true);

// Composition — all strategies keep bookingStrategy + KB flag independent
for (const mode of ["NONE", "REQUEST_ONLY", "SEND_LINK", "MICROSOFT_365", "CALENDLY"] as const) {
  const c = configForStrategy(mode, true);
  assert.equal(resolveVoiceV2BookingStrategy(c), mode);
  assert.equal(isVoiceV2KnowledgeSearchEnabled(c), true);
}

// Pinned call — search disabled without runtime load
const schema = compileVoiceV2IntakeSchema(kbCfg);
const pinnedCtx: VoiceV2CallContext = {
  sessionKey: "test",
  workspaceId: "ws-test",
  agentId: "agent-test",
  businessTimezone: "America/New_York",
  intakeSchema: schema,
  intakeState: {
    name: {
      value: "Anthony",
      status: "CAPTURED",
      source: "CALLER",
      updatedAt: new Date().toISOString(),
    },
    reason: {
      value: "kitchen leak",
      status: "CAPTURED",
      source: "CALLER",
      updatedAt: new Date().toISOString(),
    },
  },
  askedFields: {},
  compiledAt: new Date().toISOString(),
  capabilities: {
    knowledgeBaseEnabled: false,
    knowledgeBaseIds: [KB_ID],
    bookingStrategy: "MICROSOFT_365",
  },
};
async function main() {
  const disabledSearch = await executeVoiceV2SearchKnowledge(
    { query: "warranty hard water" },
    "ws-test",
    "agent-test",
    { ctx: pinnedCtx },
  );
  assert.equal(disabledSearch.status, "KNOWLEDGE_DISABLED");

  const resolved = resolveVoiceV2KnowledgeConfig(kbCfg);
  assert.ok(resolved.knowledgeBaseIds.includes(KB_ID));
  assert.equal(knowledgeConfigFromWizard(wizardWithKb(), [KB_ID]).knowledgeBaseEnabled, true);

  console.log("VOICE_V2_KNOWLEDGE_HEADLESS: PASS");
  console.log(
    JSON.stringify(
      {
        fast_faq_prompt: true,
        kb_tool_when_enabled: true,
        kb_tool_off_when_disabled: true,
        strategy_composition: ["NONE", "REQUEST_ONLY", "SEND_LINK", "MICROSOFT_365", "CALENDLY"],
        pinned_toggle: true,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
