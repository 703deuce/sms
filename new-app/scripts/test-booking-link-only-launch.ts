import assert from "node:assert/strict";
import { DEFAULT_AGENT, type AgentConfig } from "@/lib/agent";
import { normalizeReceptionistEditor } from "@/lib/server/receptionist/normalize-editor";
import { editorToVoiceV3AgentConfig } from "@/lib/server/voice-v3/editor-to-voice-v3-config";
import { conversationalIvrToolAllowlist } from "@/lib/receptionist/runtime-profile";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";

function baseEditor(): AgentConfig {
  return {
    ...DEFAULT_AGENT,
    capabilities: { ...DEFAULT_AGENT.capabilities, book: true },
    appointments: {
      ...DEFAULT_AGENT.appointments,
      strategy: "live",
      provider: "microsoft",
      bookingLink: "https://example.com/book",
    },
    runtimeProfile: "conversational_ivr",
  };
}

function run() {
  assert.equal(isBookingLinkOnlyLaunch(), true);

  const normalized = normalizeReceptionistEditor(baseEditor());
  assert.equal(normalized.appointments.strategy, "link");
  assert.equal(normalized.appointments.provider, "none");

  const v3 = editorToVoiceV3AgentConfig({
    editor: normalized,
    workspaceId: "ws_test",
    agentId: "ag_test",
    businessName: "Test Co",
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

  assert.equal(v3.scheduling.bookingStrategy, "SEND_LINK");
  assert.equal(v3.telephony?.outboundSmsMode, "platform");

  const tools = conversationalIvrToolAllowlist(normalized);
  assert.ok(tools.includes("send_booking_link"));
  assert.ok(!tools.includes("find_availability"));

  console.log("test-booking-link-only-launch: PASS");
}

run();
