#!/usr/bin/env npx tsx
/**
 * Certifies PSTN runtime config is compiled from new-app four screens only.
 */
import assert from "node:assert/strict";
import { defaultReceptionistEditorConfig } from "@/lib/server/receptionist/defaults";
import { enabledVoiceToolNamesFromEditor } from "@/lib/server/receptionist/editor-screen-mapping";
import { compilePublishedBundle } from "@/lib/server/receptionist/compile-runtime";
import { editorToVoiceV3AgentConfig } from "@/lib/server/voice-v3/editor-to-voice-v3-config";
import { isVoiceV3ToolAuthorizedBase } from "@/lib/server/voice-v3/tools/authorize-tool-for-config";

function emptyKnowledge() {
  return {
    knowledgeBaseIds: [],
    openaiVectorStoreIds: [],
    documentSourceIds: [],
    faqFacts: [],
    knowledgeItemSummaries: [],
    revision: null,
  };
}

const base = defaultReceptionistEditorConfig();

const liveBook = { ...base, capabilities: { ...base.capabilities, book: true } };
liveBook.appointments = { ...liveBook.appointments, strategy: "live", provider: "microsoft" };
const liveTools = enabledVoiceToolNamesFromEditor(liveBook);
assert.ok(liveTools.includes("book_appointment"), "live book exposes book_appointment");
assert.ok(liveTools.includes("find_availability"), "live book exposes find_availability");
assert.ok(!liveTools.includes("send_booking_link"), "live book must not expose send_booking_link");

const linkBook = { ...base, capabilities: { ...base.capabilities, book: true } };
linkBook.appointments = {
  ...linkBook.appointments,
  strategy: "link",
  bookingLink: "https://example.com/book",
};
const linkTools = enabledVoiceToolNamesFromEditor(linkBook);
assert.ok(linkTools.includes("send_booking_link"), "link strategy exposes send_booking_link");
assert.ok(!linkTools.includes("book_appointment"), "link strategy must not expose book_appointment");

const noBook = { ...base, capabilities: { ...base.capabilities, book: false } };
const noBookTools = enabledVoiceToolNamesFromEditor(noBook);
assert.ok(!noBookTools.includes("book_appointment"), "book off removes book_appointment");
assert.ok(!noBookTools.includes("send_booking_link"), "book off removes send_booking_link");

const v3Link = editorToVoiceV3AgentConfig({
  editor: linkBook,
  workspaceId: "ws_test",
  agentId: "ag_test",
  businessName: "Test Co",
  timezone: "America/Chicago",
  knowledge: emptyKnowledge(),
});
assert.equal(v3Link.source, "new_app_published");
assert.equal(v3Link.scheduling.bookingStrategy, "SEND_LINK");
assert.equal(v3Link.bookingStrategyDetail.bookingLinkUrl, "https://example.com/book");
assert.equal(isVoiceV3ToolAuthorizedBase(v3Link, "send_booking_link"), true);
assert.equal(isVoiceV3ToolAuthorizedBase(v3Link, "book_appointment"), false);

const bundle = compilePublishedBundle({
  editor: linkBook,
  workspaceId: "ws_test",
  agentId: "ag_test",
  businessName: "Test Co",
  timezone: "America/Chicago",
  businessFacts: {},
  knowledge: emptyKnowledge(),
});
assert.equal(bundle.configProvenance?.legacyWizardUsed, false);
assert.equal(bundle.configProvenance?.configSource, "new_app_receptionist");
assert.ok(bundle.runtime.promptFingerprint?.amySha256);
assert.deepEqual(
  new Set(bundle.runtime.toolNames),
  new Set(linkTools),
  "published toolNames match editor-screen-mapping",
);

console.log("test-receptionist-config-source: ALL PASS");
