#!/usr/bin/env npx tsx
/**
 * Show the exact business-knowledge block SMS recovery would pass to the FAQ LLM.
 * WORKSPACE_ID=ws_... npx tsx scripts/mctb-ai-recovery-knowledge-preview.ts
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) throw new Error("WORKSPACE_ID required");

  const { loadMctbLeadRecoveryKnowledgeBundle } = await import(
    "../src/lib/mctb/lead-recovery/knowledge-prompt"
  );
  const { loadLeadRecoveryConfig } = await import("../src/lib/mctb/lead-recovery/config");

  const [bundle, lr] = await Promise.all([
    loadMctbLeadRecoveryKnowledgeBundle(workspaceId),
    loadLeadRecoveryConfig(workspaceId),
  ]);

  console.log(
    JSON.stringify(
      {
        workspaceId,
        leadRecoveryEnabled: lr.enabled,
        policyHealth: lr.policyHealth,
        runtimePromptChars: bundle.runtime_prompt_block.length,
        aboutBusinessChars: bundle.about_business?.length ?? 0,
        runtime_prompt_block: bundle.runtime_prompt_block,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
