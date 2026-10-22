#!/usr/bin/env npx tsx
/**
 * Booking capability must align after-hours live booking policy at compile + normalize.
 */
import assert from "node:assert/strict";
import { defaultReceptionistEditorConfig } from "@/lib/server/receptionist/defaults";
import { normalizeReceptionistEditor } from "@/lib/server/receptionist/normalize-editor";
import { operatingPolicyFromEditor } from "@/lib/server/receptionist/operating-maturity-from-editor";
import { editorToVoiceV3AgentConfig } from "@/lib/server/voice-v3/editor-to-voice-v3-config";
import { isVoiceV3ToolAuthorized } from "@/lib/server/voice-v3/tools/authorize-tool-for-config";
import { DEFAULT_AFTER_HOURS_BEHAVIOR } from "@/lib/receptionist/operating-defaults";

const base = defaultReceptionistEditorConfig();
const liveBook = {
  ...base,
  capabilities: { ...base.capabilities, book: true },
  appointments: {
    ...base.appointments,
    strategy: "live" as const,
    provider: "microsoft" as const,
  },
  operating: {
    ...base.operating,
    afterHoursBehavior: {
      ...DEFAULT_AFTER_HOURS_BEHAVIOR,
      whenClosed: {
        ...DEFAULT_AFTER_HOURS_BEHAVIOR.whenClosed,
        allowLiveBooking: false,
      },
    },
  },
};

const policy = operatingPolicyFromEditor(liveBook);
assert.equal(
  policy.afterHoursBehavior.whenClosed.allowLiveBooking,
  true,
  "compile: live booking forces allowLiveBooking",
);

const normalized = normalizeReceptionistEditor(liveBook);
assert.equal(
  normalized.operating.afterHoursBehavior.whenClosed.allowLiveBooking,
  true,
  "normalize: live booking forces allowLiveBooking on editor",
);

const v3 = editorToVoiceV3AgentConfig({
  editor: liveBook,
  workspaceId: "ws_test",
  agentId: "agent_test",
  businessName: "Test",
  timezone: "America/Chicago",
  knowledge: {
    knowledgeBaseIds: [],
    openaiVectorStoreIds: [],
    documentSourceIds: [],
    faqFacts: [],
    knowledgeItemSummaries: [],
    revision: null,
  },
});

assert.ok(
  isVoiceV3ToolAuthorized(v3, "find_availability"),
  "find_availability authorized when booking on and policy aligned",
);

const noBook = { ...liveBook, capabilities: { ...liveBook.capabilities, book: false } };
const policyNoBook = operatingPolicyFromEditor(noBook);
assert.equal(
  policyNoBook.afterHoursBehavior.whenClosed.allowLiveBooking,
  false,
  "without book capability, after-hours live booking stays off",
);

console.log("PASS test-booking-operating-policy-alignment");
