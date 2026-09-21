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

const compiled = compileVoiceV3AgentConfig({
  wizard,
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  knowledgeRetrieval: {
    knowledgeBaseIds: ["kb_test_1"],
    documentSourceIds: ["src_1"],
    enabled: true,
    revision: "kb:kb_test_1:",
    websiteUrl: "https://example.com",
  },
});

assert.equal(compiled.knowledge.retrieval.enabled, true);
assert.deepEqual(compiled.knowledge.retrieval.knowledgeBaseIds, ["kb_test_1"]);
assert.deepEqual(compiled.knowledge.retrieval.documentSourceIds, ["src_1"]);

const tools = buildVoiceV3AstraFunctionToolsFromCatalog(compiled).map((t) => t.name);
assert.ok(tools.includes("search_business_knowledge"), `tools: ${tools.join(",")}`);

const knowledgePrompt = buildAstraKnowledgeInstructions(compiled);
assert.ok(knowledgePrompt?.includes("search_business_knowledge"));

console.log("test-voice-v3-knowledge-retrieval: PASS");
