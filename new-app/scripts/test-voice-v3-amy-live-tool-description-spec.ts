#!/usr/bin/env npx tsx
/**
 * LiveKit Amy tools must ship full structured descriptions (see amy-live-tool-description-spec.ts).
 */
import assert from "node:assert/strict";
import type { VoiceV3AgentConfig } from "../lib/server/voice-v3/types/agent-config";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "../lib/server/voice-v3/tools/voice-tool-catalog";
import {
  AMY_LIVE_TOOL_DESCRIPTION_REQUIRED_SECTIONS,
  assertAmyLiveToolDescriptionMeetsSpec,
} from "../lib/server/voice-v3/tools/amy-live-tool-description-spec";

const SEND_LINK_AMY_TOOLS = new Set([
  "update_intake",
  "send_booking_link",
  "transfer_call",
  "request_callback",
  "take_message",
  "search_business_knowledge",
]);

function sendLinkReceptionistConfig(): VoiceV3AgentConfig {
  return {
    source: "wizard",
    businessName: "Test Dental",
    capabilities: {
      answerQuestions: true,
      bookAppointments: false,
      checkAvailability: false,
      collectIntake: true,
      transferCalls: true,
      takeMessages: true,
      rescheduleAppointments: false,
      cancelAppointments: false,
      findAppointments: false,
    },
    scheduling: { bookingStrategy: "SEND_LINK" },
    bookingStrategyDetail: { bookingLinkUrl: "https://example.com/book" },
    conversation: {
      role: "receptionist",
      tone: "warm",
      speakingStyle: "concise",
      language: "en",
      speaksFirst: "ai",
      conversationBehaviors: {
        keepBrief: true,
        oneQuestionAtATime: true,
        confirmDetails: true,
        neverInventPricing: true,
        neverInventAvailability: true,
      },
      guardrails: [],
    },
    identity: { agentName: "Amy" },
    business: {},
    callHandling: { callbackRequestsEnabled: true },
    services: [],
    transfer: { enabled: true, routes: [{ id: "main", label: "Main" }] },
    knowledge: { retrieval: { enabled: true, openaiVectorStoreIds: [] } },
  } as VoiceV3AgentConfig;
}

function run(): void {
  const config = sendLinkReceptionistConfig();
  const tools = buildVoiceV3AstraFunctionToolsFromCatalog(config);
  const liveTools = tools.filter((t) => t.name !== "end_call");

  assert.ok(liveTools.length > 0, "expected at least one live tool");
  for (const tool of liveTools) {
    const name = String(tool.name);
    if (!SEND_LINK_AMY_TOOLS.has(name)) {
      console.log("VOICE_V3_AMY_LIVE_TOOL_SPEC_SKIP", name);
      continue;
    }
    assertAmyLiveToolDescriptionMeetsSpec(name, tool.description ?? "");
    for (const section of AMY_LIVE_TOOL_DESCRIPTION_REQUIRED_SECTIONS) {
      assert.ok(
        (tool.description ?? "").includes(section),
        `${name} must include section ${section}`,
      );
    }
  }

  const sendLink = tools.find((t) => t.name === "send_booking_link");
  assert.ok(sendLink?.description?.includes("WHEN YOU MUST USE THIS TOOL"));
  assert.ok(
    !sendLink?.description?.includes("Default: ask if you should text"),
    "send_booking_link must not use shortened inline platform-sender stub",
  );

  console.log("VOICE_V3_AMY_LIVE_TOOL_DESCRIPTION_SPEC: PASS", {
    tools_checked: liveTools.map((t) => t.name),
    sections: AMY_LIVE_TOOL_DESCRIPTION_REQUIRED_SECTIONS.length,
  });
}

run();
