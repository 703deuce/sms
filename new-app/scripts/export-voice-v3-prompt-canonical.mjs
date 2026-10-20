/**
 * Writes canonical Voice V3 prompt reference files under docs/voice-v3-prompt-exports/.
 * Usage: node new-app/scripts/export-voice-v3-prompt-canonical.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "voice-v3-prompt-exports");

const { DEFAULT_AGENT } = await import("../lib/agent.ts");
const { compilePublishedBundle } = await import("../lib/server/receptionist/compile-runtime.ts");
const {
  buildAmyHardcodedModulesCanon,
  buildAstraHardcodedModulesCanon,
} = await import("../lib/server/voice-v3/prompts/prompt-canon-export.ts");

const knowledge = {
  knowledgeBaseIds: [],
  openaiVectorStoreIds: [],
  documentSourceIds: [],
  faqFacts: [],
  knowledgeItemSummaries: [],
  revision: "export",
};

const bundle = compilePublishedBundle({
  editor: DEFAULT_AGENT,
  workspaceId: "ws_export",
  agentId: "agent_export",
  businessName: "Example Business",
  timezone: "America/New_York",
  businessFacts: {
    companyDescription: DEFAULT_AGENT.knowledgeProfile.businessOverview,
    pricingSummary: DEFAULT_AGENT.knowledgeProfile.pricing,
    paymentMethods: DEFAULT_AGENT.knowledgeProfile.paymentMethods,
    policiesSummary: DEFAULT_AGENT.knowledgeProfile.policies,
  },
  knowledge,
});

mkdirSync(outDir, { recursive: true });

const meta = `Generated: ${new Date().toISOString()}
Commit: run export script after code changes.

Runtime models (new-app publish → voice worker):
- Spoken layer: OpenAI GPT-Live-1 (LiveKit GPTLiveModel), voice = liveVoiceId from publish
- Delegation backend: astraModel on published bundle (default gpt-6-luna unless VOICE_V3_ASTRA_MODEL)
- NOT the legacy single-session gpt-4o-realtime API

Source code roots:
- Amy assembly: new-app/lib/server/voice-v3/prompts/live-frontend-instructions.ts
- Astra assembly: new-app/lib/server/voice-v3/prompts/astra-backend-instructions.ts
- Compile: new-app/lib/server/receptionist/compile-runtime.ts → runtime.amyInstructions / astraInstructions
`;

writeFileSync(join(outDir, "README.txt"), meta);

writeFileSync(
  join(outDir, "01-amy-hardcoded-modules.txt"),
  buildAmyHardcodedModulesCanon(),
  "utf8",
);

writeFileSync(
  join(outDir, "02-astra-hardcoded-modules.txt"),
  buildAstraHardcodedModulesCanon(),
  "utf8",
);

writeFileSync(
  join(outDir, "03-amy-full-runtime-default-agent.txt"),
  bundle.runtime.amyInstructions,
  "utf8",
);

writeFileSync(
  join(outDir, "04-astra-full-runtime-default-agent.txt"),
  bundle.runtime.astraInstructions,
  "utf8",
);

writeFileSync(
  join(outDir, "05-runtime-metadata.json"),
  JSON.stringify(
    {
      astraModel: bundle.runtime.astraModel,
      liveVoiceId: bundle.runtime.liveVoiceId,
      amyChars: bundle.runtime.amyInstructions.length,
      astraChars: bundle.runtime.astraInstructions.length,
      toolNames: bundle.runtime.toolNames,
    },
    null,
    2,
  ),
  "utf8",
);

const combined = [
  "################################################################################",
  "# AMY (GPT-Live-1) — FULL RUNTIME INSTRUCTIONS (DEFAULT_AGENT sample publish)",
  "################################################################################",
  bundle.runtime.amyInstructions,
  "",
  "################################################################################",
  "# ASTRA (gpt-6-luna delegation) — FULL RUNTIME INSTRUCTIONS",
  "################################################################################",
  bundle.runtime.astraInstructions,
].join("\n");

writeFileSync(join(outDir, "TRANSOVO-NEW-APP-VOICE-V3-PROMPT-CANON-FULL-RUNTIME.txt"), combined, "utf8");

console.log("Wrote Voice V3 prompt exports to", outDir);
console.log("astraModel:", bundle.runtime.astraModel);
console.log("amy chars:", bundle.runtime.amyInstructions.length);
console.log("astra chars:", bundle.runtime.astraInstructions.length);
