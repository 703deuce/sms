#!/usr/bin/env npx tsx
/**
 * Certifies PSTN runtime config is compiled from new-app four screens only.
 */
import assert from "node:assert/strict";
import { defaultReceptionistEditorConfig } from "@/lib/server/receptionist/defaults";
import { enabledVoiceToolNamesFromEditor } from "@/lib/server/receptionist/editor-screen-mapping";
import { compilePublishedBundle } from "@/lib/server/receptionist/compile-runtime";
import {
  coalesceRuntimeProfileForVoiceConfig,
  conversationalIvrToolAllowlist,
  isConversationalIvrRuntime,
  withRuntimeProfileFromEditor,
} from "@/lib/receptionist/runtime-profile";
import { voiceV3AgentConfigFromBundle } from "@/lib/server/voice-v3/bundle-voice-config";
import { editorToVoiceV3AgentConfig } from "@/lib/server/voice-v3/editor-to-voice-v3-config";
import { isVoiceV3ToolAuthorizedBase } from "@/lib/server/voice-v3/tools/authorize-tool-for-config";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "@/lib/server/voice-v3/tools/voice-tool-catalog";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";

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

/** Full receptionist booking paths — require explicit profile (default draft is Conversational IVR). */
function asFullReceptionist(editor: typeof base): typeof base {
  return { ...editor, runtimeProfile: "full_receptionist" };
}

const ivrTools = enabledVoiceToolNamesFromEditor(base);
assert.ok(ivrTools.includes("end_call"), "IVR default exposes end_call");
assert.ok(ivrTools.includes("search_business_knowledge"), "IVR default exposes knowledge");
assert.ok(!ivrTools.includes("book_appointment"), "IVR default must not expose book_appointment");
assert.ok(!ivrTools.includes("update_intake"), "IVR default must not expose update_intake");

const liveBook = asFullReceptionist({
  ...base,
  capabilities: { ...base.capabilities, book: true },
});
liveBook.appointments = { ...liveBook.appointments, strategy: "live", provider: "microsoft" };
const liveTools = enabledVoiceToolNamesFromEditor(liveBook);
assert.ok(liveTools.includes("book_appointment"), "live book exposes book_appointment");
assert.ok(liveTools.includes("find_availability"), "live book exposes find_availability");
assert.ok(!liveTools.includes("send_booking_link"), "live book must not expose send_booking_link");

const linkBook = asFullReceptionist({
  ...base,
  capabilities: { ...base.capabilities, book: true },
});
linkBook.appointments = {
  ...linkBook.appointments,
  strategy: "link",
  bookingLink: "https://example.com/book",
};
const linkTools = enabledVoiceToolNamesFromEditor(linkBook);
assert.ok(linkTools.includes("send_booking_link"), "link strategy exposes send_booking_link");
assert.ok(!linkTools.includes("book_appointment"), "link strategy must not expose book_appointment");

const noBook = asFullReceptionist({
  ...base,
  capabilities: { ...base.capabilities, book: false },
});
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

const requestEditor = asFullReceptionist({
  ...base,
  capabilities: { ...base.capabilities, book: true },
});
requestEditor.appointments = { ...requestEditor.appointments, strategy: "request" };
const requestV3 = editorToVoiceV3AgentConfig({
  editor: requestEditor,
  workspaceId: "ws_test",
  agentId: "ag_test",
  businessName: "Test Co",
  timezone: "America/Chicago",
  knowledge: emptyKnowledge(),
});
if (isBookingLinkOnlyLaunch()) {
  assert.equal(requestV3.scheduling.bookingStrategy, "SEND_LINK");
} else {
  assert.equal(requestV3.scheduling.bookingStrategy, "REQUEST_ONLY");
  assert.ok(
    enabledVoiceToolNamesFromEditor(requestEditor).includes("submit_appointment_request"),
  );
}

const wired = editorToVoiceV3AgentConfig({
  editor: base,
  workspaceId: "ws_test",
  agentId: "ag_test",
  businessName: "Test Co",
  timezone: "America/Chicago",
  knowledge: emptyKnowledge(),
});
assert.ok(wired.callHandling.transferTriggers.length > 0);
assert.ok(wired.operatingPolicy?.businessSchedule?.weekly?.monday);
assert.ok(wired.transfer?.enabled !== undefined);

// Full Receptionist publish must not lose booking tools when snapshot omits runtimeProfile.
const fullLive = asFullReceptionist({
  ...base,
  capabilities: { ...base.capabilities, book: true },
});
fullLive.appointments = {
  ...fullLive.appointments,
  strategy: "live",
  provider: "microsoft",
};
const fullBundle = compilePublishedBundle({
  editor: fullLive,
  workspaceId: "ws_test",
  agentId: "ag_test",
  businessName: "Test Co",
  timezone: "America/Chicago",
  businessFacts: {},
  knowledge: emptyKnowledge(),
});
const snap = fullBundle.runtime.voiceV3 as { voiceV3AgentConfig?: Record<string, unknown> };
if (snap?.voiceV3AgentConfig) {
  delete snap.voiceV3AgentConfig.runtimeProfile;
}
const fromBundle = voiceV3AgentConfigFromBundle(fullBundle, {
  workspaceId: "ws_test",
  agentId: "ag_test",
});
assert.equal(
  coalesceRuntimeProfileForVoiceConfig(fullLive, fromBundle),
  "full_receptionist",
  "editor full_receptionist wins when snapshot omits runtimeProfile",
);
assert.equal(isConversationalIvrRuntime(fromBundle), false);
const catalogNames = buildVoiceV3AstraFunctionToolsFromCatalog(fromBundle).map((t) =>
  String(t.name),
);
assert.ok(
  catalogNames.includes("book_appointment"),
  "catalog must expose book_appointment for full receptionist live book",
);
assert.ok(
  catalogNames.includes("find_availability"),
  "catalog must expose find_availability",
);

const strippedProfile = { ...fromBundle, runtimeProfile: undefined };
const ivrOnly = withRuntimeProfileFromEditor(base, strippedProfile);
assert.equal(isConversationalIvrRuntime(ivrOnly), true);
const ivrCatalog = buildVoiceV3AstraFunctionToolsFromCatalog(ivrOnly).map((t) => String(t.name));
assert.ok(!ivrCatalog.includes("book_appointment"), "IVR catalog must not include book_appointment");

const ivrLinkBook = {
  ...base,
  capabilities: { ...base.capabilities, book: true },
};
ivrLinkBook.appointments = {
  ...ivrLinkBook.appointments,
  strategy: "link",
  bookingLink: "https://example.com/book",
};
const ivrLinkV3 = editorToVoiceV3AgentConfig({
  editor: ivrLinkBook,
  workspaceId: "ws_test",
  agentId: "ag_test",
  businessName: "Test Co",
  timezone: "America/Chicago",
  knowledge: emptyKnowledge(),
});
assert.equal(isConversationalIvrRuntime(ivrLinkV3), true);
assert.equal(isVoiceV3ToolAuthorizedBase(ivrLinkV3, "send_booking_link"), true);
const ivrLinkCatalog = buildVoiceV3AstraFunctionToolsFromCatalog(ivrLinkV3).map((t) =>
  String(t.name),
);
assert.ok(
  ivrLinkCatalog.includes("send_booking_link"),
  "conversational IVR + SEND_LINK must expose send_booking_link in Astra catalog",
);
assert.ok(
  conversationalIvrToolAllowlist(ivrLinkBook).includes("send_booking_link"),
  "editor allowlist and Astra catalog stay aligned for send_booking_link",
);

console.log("test-receptionist-config-source: ALL PASS");
