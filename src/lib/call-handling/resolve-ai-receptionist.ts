import "server-only";

import { resolveCanonicalVoiceV3WorkspaceAgent } from "@/lib/voice-v3/canonical-workspace-agent";

export type ResolvedAiReceptionist = {
  agentId: string;
  /** May differ from canonical voice ingress. */
  aiVoicePhoneNumberId: string | null;
  status: string;
  published: boolean;
};

/**
 * Resolve the AI Receptionist for Call Handling — always the workspace canonical
 * GPT-Live V3 agent (cert DID / VOICE_V3_CANONICAL_AGENT_ID), never legacy agents.
 */
export async function resolveAiReceptionistForCallHandling(input: {
  workspaceId: string;
  preferredAgentId?: string | null;
}): Promise<ResolvedAiReceptionist | null> {
  const canonical = await resolveCanonicalVoiceV3WorkspaceAgent(input.workspaceId);
  if (!canonical) return null;

  if (
    input.preferredAgentId?.trim() &&
    input.preferredAgentId.trim() !== canonical.agentId
  ) {
    console.warn("CALL_HANDLING_CANONICAL_AGENT_OVERRIDE", {
      workspaceId: input.workspaceId,
      parkedAgentId: input.preferredAgentId.trim(),
      canonicalAgentId: canonical.agentId,
    });
  }

  return {
    agentId: canonical.agentId,
    aiVoicePhoneNumberId: canonical.primaryPhoneNumberId,
    status: canonical.status,
    published: canonical.published,
  };
}
