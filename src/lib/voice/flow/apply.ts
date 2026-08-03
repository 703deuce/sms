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

  const compiled = compileVoiceFlowBundle(bundle, {
    preserveTools: base.enabledBuiltinTools || [],
  });

  const baseTransfers = (base.transfers || {}) as Record<string, unknown>;
  const patchTransfers = (compiled.configPatch.transfers || {}) as Record<
    string,
    unknown
  >;
  const baseTargets = Array.isArray(baseTransfers.targets)
    ? (baseTransfers.targets as Array<{ name?: string; to?: string }>)
    : [];
  const patchTargets = Array.isArray(patchTransfers.targets)
    ? (patchTransfers.targets as Array<{ name?: string; to?: string }>)
    : [];
  const destPhone = String(
    baseTransfers.destinationPhone ||
      baseTargets.find((t) => t.to)?.to ||
      "",
  ).trim();
  const destName = String(
    baseTransfers.destinationName || "Agent Handoff",
  ).trim();
  const mergedTargetMap = new Map<string, { name: string; to: string }>();
  for (const t of [...patchTargets, ...baseTargets]) {
    const name = String(t.name || "").trim();
    if (!name) continue;
    const to = String(t.to || "").trim() || destPhone;
    const prev = mergedTargetMap.get(name.toLowerCase());
    // Prefer non-empty destination numbers.
    if (!prev || (!prev.to && to)) {
      mergedTargetMap.set(name.toLowerCase(), { name, to });
    }
  }
  if (destPhone) {
    for (const name of [destName, "Agent Handoff", "Front Desk"]) {
      const key = name.toLowerCase();
      const prev = mergedTargetMap.get(key);
      if (!prev || !prev.to) {
        mergedTargetMap.set(key, { name, to: destPhone });
      }
    }
  }

  const baseInstructions = (base.instructions || {}) as Record<string, unknown>;
  const patchInstructions = (compiled.configPatch.instructions || {}) as Record<
    string,
    unknown
  >;
  const wizardSystem = String(baseInstructions.system || "").trim();
  const flowSystem = String(patchInstructions.system || "").trim();
  // Keep wizard (or builder) system prompt first; append flow/global rules.
  const mergedSystem = [wizardSystem, flowSystem].filter(Boolean).join("\n\n");

  const config = mergeVoiceConfig(base, {
    ...compiled.configPatch,
    instructions: {
      ...baseInstructions,
      ...patchInstructions,
      system: mergedSystem || flowSystem || wizardSystem,
      // Prefer wizard escalation / uncertainty when present.
      escalation:
        (baseInstructions.escalation as string | undefined) ||
        (patchInstructions.escalation as string | undefined),
      uncertainty:
        (baseInstructions.uncertainty as string | undefined) ||
        (patchInstructions.uncertainty as string | undefined),
      role: (baseInstructions.role as string | undefined) || undefined,
      goals: (baseInstructions.goals as string | undefined) || undefined,
      tone: (baseInstructions.tone as string | undefined) || undefined,
      style: (baseInstructions.style as string | undefined) || undefined,
      prohibited:
        (baseInstructions.prohibited as string[] | undefined) ||
        (patchInstructions.prohibited as string[] | undefined),
    },
    transfers: {
      ...baseTransfers,
      ...patchTransfers,
      destinationName: destName,
      destinationPhone: destPhone || String(baseTransfers.destinationPhone || ""),
      targets: [...mergedTargetMap.values()],
      // Keep cold Call Control unless the base explicitly set warm instructions.
      warmTransferInstructions:
        String(baseTransfers.warmTransferInstructions || "").trim() || "",
    },
    flows: bundle,
    enabledBuiltinTools: [
      ...new Set([
        ...(compiled.enabledBuiltinTools || []),
        ...(base.enabledBuiltinTools || []),
      ]),
    ],
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
