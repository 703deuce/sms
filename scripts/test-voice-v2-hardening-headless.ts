#!/usr/bin/env npx tsx
/**
 * Voice V2 integration hardening — capability pin, mode matrix, publish resolve.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-hardening-headless.ts
 */
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  WORKFLOW_NODE_IDS,
  workflowNodeExpectedTools,
} from "../src/lib/voice/telnyx/conversation-workflow";
import { resolveVoiceV2KnowledgeConfig } from "../src/lib/voice-receptionist-wizard/knowledge-config";
import { resolveVoiceV2QualificationConfig } from "../src/lib/voice-receptionist-wizard/qualification-config";
import {
  buildRecordFromLegacy,
  syncLegacyFromRecord,
} from "../src/lib/voice-receptionist-wizard/session/legacy-bridge";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function configForStrategy(
  strategy: "NONE" | "REQUEST_ONLY" | "SEND_LINK" | "MICROSOFT_365" | "CALENDLY",
  extras?: { knowledge?: boolean; qualification?: boolean },
): VoiceAgentConfig {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.bookingStrategy = strategy;
  if (strategy === "MICROSOFT_365" || strategy === "CALENDLY") {
    wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments"])];
    wizard.calendarConnected = true;
    wizard.calendarProvider = strategy === "CALENDLY" ? "calendly" : "microsoft";
  }
  if (strategy === "SEND_LINK") {
    wizard.bookingLinkUrl = "https://example.com/book";
    wizard.bookingLinkLabel = "Book online";
  }
  if (extras?.knowledge) {
    wizard.knowledgeBaseEnabled = true;
    wizard.linkedKnowledgeBaseId = "kb_test_hardening";
  }
  if (extras?.qualification) {
    wizard.qualificationEnabled = true;
    wizard.qualificationRules = [
      { id: "r1", fieldKey: "zip", operator: "EXISTS", value: "" },
    ];
    wizard.collectFields = (wizard.collectFields || []).map((f) =>
      f.id === "zip" ? { ...f, enabled: true, useForQualification: true } : f,
    );
  }
  const advanced = mergeAppointmentWizardAdvanced(wizard, {});
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      ...advanced,
      conversationWorkflowMode: true,
    },
  } as VoiceAgentConfig);
}

const v2Ids = {
  findId: "v2_find",
  bookId: "v2_book",
  saveIntakeId: "v2_save",
  finalizeRequestId: "v2_finalize",
  sendBookingLinkId: "v2_link",
  searchKnowledgeId: "v2_kb",
};

// Qualification published shape from wizard bridge
const qualCfg = configForStrategy("MICROSOFT_365", { qualification: true });
const qualResolved = resolveVoiceV2QualificationConfig(qualCfg);
pass("QUAL_PUBLISH_RESOLVE", qualResolved.qualificationEnabled === true);
pass(
  "QUAL_PINNED_REVISION",
  Boolean(qualResolved.qualificationRevision && qualResolved.qualificationRevision !== "none"),
);

const kbCfg = configForStrategy("NONE", { knowledge: true });
pass(
  "KB_PUBLISH_RESOLVE",
  resolveVoiceV2KnowledgeConfig(kbCfg).knowledgeBaseEnabled === true,
);

// L2 capability roundtrip
const payload: VoiceV2CallContext = {
  sessionKey: "call:hard",
  workspaceId: "ws",
  agentId: "ag",
  businessTimezone: "America/New_York",
  intakeSchema: { fields: {} },
  intakeState: {},
  askedFields: {},
  compiledAt: new Date().toISOString(),
  intakeSaveCount: 0,
  capabilities: {
    bookingStrategy: "MICROSOFT_365",
    qualificationEnabled: true,
    qualificationRevision: "qual:test",
    qualificationFieldKeys: ["zip"],
    knowledgeBaseEnabled: true,
    knowledgeBaseRevision: "kb:test",
    knowledgeBaseIds: ["kb_1"],
  },
};
const record = buildRecordFromLegacy({
  payload,
  identity: {
    sessionKey: "call:hard",
    callId: "c1",
    workspaceId: "ws",
    agentId: "ag",
  },
  enrollment: { enrolledAt: new Date().toISOString() },
});
pass("L2_RECORD_QUAL", record.capabilities.qualificationEnabled === true);
pass("L2_RECORD_KB_IDS", record.capabilities.knowledgeBaseIds?.[0] === "kb_1");
payload.capabilities = {};
const synced = syncLegacyFromRecord(record);
pass("L2_SYNC_QUAL", synced.capabilities?.qualificationEnabled === true);
pass("L2_SYNC_KB", synced.capabilities?.knowledgeBaseRevision === "kb:test");

// Mode matrix — tool leakage
for (const strategy of [
  "NONE",
  "REQUEST_ONLY",
  "SEND_LINK",
  "MICROSOFT_365",
  "CALENDLY",
] as const) {
  const cfg = configForStrategy(strategy);
  const tools = workflowNodeExpectedTools(WORKFLOW_NODE_IDS.GENERAL, {
    voiceV2Find:
      strategy === "MICROSOFT_365" || strategy === "CALENDLY" ? v2Ids.findId : null,
    voiceV2Book:
      strategy === "MICROSOFT_365" || strategy === "CALENDLY" ? v2Ids.bookId : null,
    voiceV2SaveIntake: v2Ids.saveIntakeId,
    voiceV2FinalizeRequest:
      strategy === "SEND_LINK" ? null : v2Ids.finalizeRequestId,
    voiceV2SendBookingLink: strategy === "SEND_LINK" ? v2Ids.sendBookingLinkId : null,
    voiceV2SearchKnowledge: null,
  });
  const hasFind = tools.includes("voice_v2_find_availability");
  const hasBook = tools.includes("voice_v2_book_offered_slot");
  const live = strategy === "MICROSOFT_365" || strategy === "CALENDLY";
  pass(`MODE_${strategy}_FIND`, hasFind === live, `find=${hasFind}`);
  pass(`MODE_${strategy}_BOOK`, hasBook === live, `book=${hasBook}`);
  pass(
    `MODE_${strategy}_SEND_LINK`,
    strategy === "SEND_LINK"
      ? tools.includes("voice_v2_send_booking_link")
      : !tools.includes("voice_v2_send_booking_link"),
  );
  pass(
    `MODE_${strategy}_NO_LEGACY_BOOK`,
    !tools.includes("voice_ai_booking_turn"),
  );
}

const kbOn = configForStrategy("REQUEST_ONLY", { knowledge: true });
const kbTools = workflowNodeExpectedTools(WORKFLOW_NODE_IDS.GENERAL, {
  voiceV2SaveIntake: v2Ids.saveIntakeId,
  voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  voiceV2SearchKnowledge: v2Ids.searchKnowledgeId,
});
pass("KB_TOOL_WHEN_ON", kbTools.includes("voice_v2_search_knowledge"));
const kbOff = workflowNodeExpectedTools(WORKFLOW_NODE_IDS.GENERAL, {
  voiceV2SaveIntake: v2Ids.saveIntakeId,
  voiceV2FinalizeRequest: v2Ids.finalizeRequestId,
  voiceV2SearchKnowledge: null,
});
pass("KB_TOOL_WHEN_OFF", !kbOff.includes("voice_v2_search_knowledge"));

console.log("\n--- Voice V2 hardening headless ---");
if (failures.length) {
  console.error(`${failures.length} failure(s):`);
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("All hardening checks passed.");
