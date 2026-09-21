#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config.ts";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config.ts";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "../src/lib/voice-v3/tools/voice-tool-catalog.ts";
import { buildAstraKnowledgeInstructions } from "../src/lib/voice-v3/knowledge/astra-knowledge-instructions.ts";

const wizard = {
  solutionName: "Test",
  businessName: "Acme",
  agentName: "Amy",
  capabilities: ["answer_questions", "book_appointments"],
  linkedKnowledgeBaseId: "kb_test_1",
  knowledgeBaseEnabled: true,
  knowledgeSource: "website",
  websiteUrl: "https://example.com",
  knowledgeItems: [],
  appointmentTypes: [],
  collectFields: [],
} as import("../src/lib/solutions/appointment-receptionist/types").AppointmentReceptionistWizardState;

const compiledGptLive = compileVoiceV3AgentConfig({
  wizard,
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  knowledgeRetrieval: {
    knowledgeBaseIds: ["kb_test_1"],
    documentSourceIds: ["src_1"],
    openaiVectorStoreIds: ["vs_test_abc"],
    enabled: true,
    revision: "kb:kb_test_1:",
    websiteUrl: "https://example.com",
  },
});

assert.equal(compiledGptLive.knowledge.retrieval.enabled, true);
assert.deepEqual(compiledGptLive.knowledge.retrieval.openaiVectorStoreIds, ["vs_test_abc"]);

const gptLiveTools = buildVoiceV3AstraFunctionToolsFromCatalog(compiledGptLive).map((t) => t.name);
assert.ok(
  !gptLiveTools.includes("search_business_knowledge"),
  `search_business_knowledge should be off when file_search vector stores are set: ${gptLiveTools.join(",")}`,
);

const gptLivePrompt = buildAstraKnowledgeInstructions(compiledGptLive);
assert.ok(gptLivePrompt?.includes("file_search"));

const compiledLegacy = compileVoiceV3AgentConfig({
  wizard,
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  knowledgeRetrieval: {
    knowledgeBaseIds: ["kb_test_1"],
    documentSourceIds: ["src_1"],
    openaiVectorStoreIds: [],
    enabled: true,
    revision: "kb:kb_test_1:",
    websiteUrl: "https://example.com",
  },
});

const legacyTools = buildVoiceV3AstraFunctionToolsFromCatalog(compiledLegacy).map((t) => t.name);
assert.ok(legacyTools.includes("search_business_knowledge"), `tools: ${legacyTools.join(",")}`);

console.log("test-voice-v3-knowledge-retrieval: PASS");
