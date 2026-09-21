#!/usr/bin/env npx tsx
/**
 * FileSearch session configuration certification (Node compile + Python worker constants).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config.ts";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config.ts";
import { resolveOpenAiFileSearchVectorStoreIdsForSession } from "../src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts";
import {
  buildVoiceV3AstraFunctionToolsFromCatalog,
  listVoiceV3AstraToolNamesForConfig,
} from "../src/lib/voice-v3/tools/voice-tool-catalog.ts";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types.ts";

const sessionPy = readFileSync(
  resolve("voice-runtime-python/transovo_voice/voice_v3/session.py"),
  "utf8",
);

assert.ok(sessionPy.includes('model="gpt-live-1"'), "GPTLiveModel must use gpt-live-1");
assert.ok(
  sessionPy.includes('delegation="responses"'),
  "GPTLiveModel must use responses delegation",
);
assert.ok(sessionPy.includes("FileSearch(vector_store_ids="), "FileSearch attach path present");

const wizard = {
  solutionName: "Cert",
  businessName: "Cert Business",
  agentName: "Cert Agent",
  capabilities: ["answer_questions", "book_appointments"],
  bookingStrategy: "MICROSOFT_365",
  appointmentTypes: [],
  collectFields: [],
} as AppointmentReceptionistWizardState;

const noKb = compileVoiceV3AgentConfig({
  wizard,
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  knowledgeRetrieval: { enabled: false, knowledgeBaseIds: [], openaiVectorStoreIds: [] },
});
const noVs = resolveOpenAiFileSearchVectorStoreIdsForSession(noKb);
assert.deepEqual(noVs, [], "A: no vector-store IDs when knowledge disabled");

const withKb = compileVoiceV3AgentConfig({
  wizard,
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  knowledgeRetrieval: {
    enabled: true,
    knowledgeBaseIds: ["kb_cert"],
    openaiVectorStoreIds: ["vs_cert_a", "vs_cert_b"],
  },
});
const vs = resolveOpenAiFileSearchVectorStoreIdsForSession(withKb);
assert.deepEqual(vs, ["vs_cert_a", "vs_cert_b"], "B: session receives configured vector-store IDs");

const toolNames = buildVoiceV3AstraFunctionToolsFromCatalog(withKb).map((t) => String(t.name));
const astraTools = listVoiceV3AstraToolNamesForConfig(withKb);
assert.ok(astraTools.includes("find_availability"), "C: Transovo FunctionTools remain");
assert.ok(!toolNames.includes("search_business_knowledge"), "D: no custom RAG FunctionTool");

function simulatePythonFileSearchAttach(vectorStoreIds: string[]): number {
  const cleaned = vectorStoreIds.map((v) => v.trim()).filter(Boolean);
  return cleaned.length > 0 ? 1 : 0;
}
assert.equal(simulatePythonFileSearchAttach([]), 0);
assert.equal(simulatePythonFileSearchAttach(["vs_1", "vs_2"]), 1);

console.log("test-voice-v3-filesearch-session-cert: PASS");
