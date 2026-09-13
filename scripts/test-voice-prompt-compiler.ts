/**
 * Voice prompt compiler — prompt-first knowledge, section layering, wizard wiring.
 * npx tsx scripts/test-voice-prompt-compiler.ts
 */
import assert from "node:assert/strict";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildSystemPrompt } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import {
  compileVoiceAgentPrompt,
  VOICE_PROMPT_COMPILER_VERSION,
} from "../src/lib/voice/prompt/compile-voice-agent-prompt";
import { TRANSOVO_BASE_VOICE_RULES_VERSION } from "../src/lib/voice/prompt/base-voice-rules";
import { knowledgeRouteForItemId } from "../src/lib/voice/prompt/knowledge-classification";

function main() {
  const state = createDefaultWizardState();
  state.businessName = "ABC Plumbing";
  state.agentName = "Amy";
  state.knowledgeItems = state.knowledgeItems.map((item) => {
    if (item.id === "hours") {
      return { ...item, status: "complete", summary: "Mon–Fri 8 AM–6 PM" };
    }
    if (item.id === "services") {
      return {
        ...item,
        status: "complete",
        summary: "drain cleaning, water heaters, leak repair, sewer repair",
      };
    }
    if (item.id === "pricing") {
      return { ...item, status: "complete", summary: "Diagnostic fee $89" };
    }
    return item;
  });

  const compiled = compileVoiceAgentPrompt({ wizard: state, profile: "after_hours" });
  assert.equal(compiled.metadata.compilerVersion, VOICE_PROMPT_COMPILER_VERSION);
  assert.equal(compiled.metadata.baseRulesVersion, TRANSOVO_BASE_VOICE_RULES_VERSION);
  assert.ok(compiled.systemPrompt.includes("ABC Plumbing"));
  assert.ok(compiled.systemPrompt.includes("Mon–Fri 8 AM–6 PM"));
  assert.ok(compiled.systemPrompt.includes("Diagnostic fee $89"));
  assert.ok(compiled.systemPrompt.includes("KNOWLEDGE HIERARCHY"));
  assert.ok(
    compiled.systemPrompt.includes("not to get the caller booked at all costs"),
    "after-hours role must describe V1 outcomes",
  );
  assert.ok(compiled.systemPrompt.includes("Do NOT call tools"));
  assert.ok(compiled.metadata.includedSectionIds.includes("businessHours"));
  assert.ok(!compiled.metadata.ragIncluded);

  const viaBuild = buildSystemPrompt(state);
  const viaWizardHelper = compileVoiceAgentPrompt({ wizard: state }).systemPrompt;
  assert.equal(viaBuild, viaWizardHelper, "buildSystemPrompt must use canonical compiler");

  assert.equal(knowledgeRouteForItemId("hours"), "PROMPT_CONTEXT");
  assert.equal(knowledgeRouteForItemId("documents"), "RAG_CONTEXT");

  const withRag = compileVoiceAgentPrompt({
    wizard: state,
    retrievedKnowledge: "Toto Drake CST776: in stock per 2024 catalog.",
  });
  assert.ok(withRag.metadata.ragIncluded);
  assert.ok(withRag.systemPrompt.includes("Toto Drake"));

  console.log("test-voice-prompt-compiler: PASS");
  console.log(`  sections: ${compiled.metadata.includedSectionIds.join(", ")}`);
  console.log(`  chars: ${compiled.systemPrompt.length}`);
}

main();
