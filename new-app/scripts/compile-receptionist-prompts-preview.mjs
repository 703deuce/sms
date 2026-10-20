/**
 * Compile legacy Voice V3 frontend + backend prompts from a receptionist editor snapshot.
 * Usage: node new-app/scripts/compile-receptionist-prompts-preview.mjs
 */
import { DEFAULT_AGENT } from "../lib/agent.ts";

const { compilePublishedBundle } = await import("../lib/server/receptionist/compile-runtime.ts");

const editor = DEFAULT_AGENT;
const knowledge = {
  knowledgeBaseIds: [],
  openaiVectorStoreIds: [],
  documentSourceIds: [],
  faqFacts: ["Q: Do you accept walk-ins?\nA: Yes, before 4pm weekdays."],
  knowledgeItemSummaries: [
    { id: "faq-1", label: "Walk-ins", summary: "Yes, before 4pm weekdays." },
  ],
  revision: "test",
};

const bundle = compilePublishedBundle({
  editor,
  workspaceId: "ws_preview",
  agentId: "agent_preview",
  businessName: "Harbor & Pine Dental",
  timezone: "America/New_York",
  businessFacts: {
    companyDescription: "Family dental practice",
    hoursDisplay: "Mon–Fri 8am–5pm\n(Timezone: America/New_York)",
    servicesSummary: "Cleaning, Exam",
  },
  knowledge,
});

console.log("amyInstructions chars:", bundle.runtime.amyInstructions.length);
console.log("astraInstructions chars:", bundle.runtime.astraInstructions.length);
console.log("amy has BUSINESS FACTS:", bundle.runtime.amyInstructions.includes("BUSINESS FACTS"));
console.log("amy has GPT-LIVE:", bundle.runtime.amyInstructions.includes("GPT-LIVE"));
console.log("astra has Astra backend:", bundle.runtime.astraInstructions.includes("reasoning and tool-use backend"));
console.log("vector stores:", bundle.runtime.openaiFileSearchVectorStoreIds);
