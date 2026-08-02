/**
 * Apply visual flow compilation onto an agent draft before build/publish.
 */

import { getPrisma } from "@/lib/db";
import { mergeVoiceConfig, parseVoiceAgentConfig, type VoiceAgentConfig } from "../types";
import { compileVoiceFlowBundle, syncRoutingRulesFromFlow } from "./compile";
import { defaultFlowBundleForAgentType } from "./templates";
import { parseVoiceFlowBundle } from "./types";
import {
  hasBlockingFlowErrors,
  validateVoiceFlowBundle,
  type FlowIssue,
} from "./validation";

export async function applyFlowToAgentDraft(input: {
  workspaceId: string;
  agentId: string;
  agentType?: string | null;
  draftConfig?: VoiceAgentConfig | null;
  /** When true, throw on blocking flow validation errors. */
  strict?: boolean;
}): Promise<{
  config: VoiceAgentConfig;
  issues: FlowIssue[];
  compiled: ReturnType<typeof compileVoiceFlowBundle>;
}> {
  const prisma = getPrisma();
  const base = parseVoiceAgentConfig(input.draftConfig);
  const rawFlows = base.flows;
  const bundle =
    rawFlows &&
    ((rawFlows as { routing?: unknown }).routing ||
      (rawFlows as { conversation?: unknown }).conversation)
      ? parseVoiceFlowBundle(rawFlows)
      : defaultFlowBundleForAgentType(input.agentType);

  const issues = validateVoiceFlowBundle(bundle);
  if (input.strict && hasBlockingFlowErrors(issues)) {
    const err = new Error("Flow validation failed");
    (err as Error & { issues: FlowIssue[] }).issues = issues;
    throw err;
  }

  const compiled = compileVoiceFlowBundle(bundle);
  const config = mergeVoiceConfig(base, {
    ...compiled.configPatch,
    flows: bundle,
    enabledBuiltinTools: compiled.enabledBuiltinTools,
  });

  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { draftConfig: config as object },
  });

  // Persist tool enablement for gateway + Telnyx sync.
  const draft = config as VoiceAgentConfig;
  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: {
      draftConfig: {
        ...draft,
        enabledBuiltinTools: compiled.enabledBuiltinTools,
        toolIds: draft.toolIds || [],
      } as object,
    },
  });

  await syncRoutingRulesFromFlow({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    compiled,
  }).catch((err) =>
    console.warn(
      "[voice/flow] routing sync failed",
      err instanceof Error ? err.message : err,
    ),
  );

  return { config, issues, compiled };
}
