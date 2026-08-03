import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "./types";

/**
 * Load the config the live call runtime should use: published version first,
 * then draftConfig. Never read a non-existent VoiceAgent.config column.
 */
export async function loadVoiceAgentRuntimeConfig(
  workspaceId: string,
  agentId: string,
): Promise<VoiceAgentConfig> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { publishedVersionId: true, draftConfig: true },
  });
  if (!agent) return parseVoiceAgentConfig({});

  if (agent.publishedVersionId) {
    const ver = await prisma.voiceAgentVersion.findFirst({
      where: { id: agent.publishedVersionId, workspaceId },
      select: { config: true },
    });
    if (ver?.config) return parseVoiceAgentConfig(ver.config);
  }

  return parseVoiceAgentConfig(agent.draftConfig || {});
}

/** Same as loadVoiceAgentRuntimeConfig but returns a plain record for loose tool reads. */
export async function loadVoiceAgentRuntimeConfigRecord(
  workspaceId: string,
  agentId: string,
): Promise<Record<string, unknown>> {
  const cfg = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  return cfg as unknown as Record<string, unknown>;
}
