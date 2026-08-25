import { getPrisma } from "@/lib/db";
import type { VoiceAgentConfig } from "@/lib/voice/types";

export type PublishVoiceAgentVersionInput = {
  workspaceId: string;
  agentId: string;
  config: VoiceAgentConfig | object;
  changeLog: string;
  publishedBy?: string;
};

export type PublishVoiceAgentVersionResult = {
  versionId: string;
  versionNumber: number;
};

/** Create an immutable published version and point the agent at it. */
export async function publishVoiceAgentVersion(
  input: PublishVoiceAgentVersionInput,
): Promise<PublishVoiceAgentVersionResult> {
  const prisma = getPrisma();
  const latestVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId: input.agentId, workspaceId: input.workspaceId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  await prisma.voiceAgentVersion.updateMany({
    where: { agentId: input.agentId, workspaceId: input.workspaceId, isMain: true },
    data: { isMain: false },
  });

  const row = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      version: nextVersion,
      config: input.config as object,
      changeLog: input.changeLog,
      isMain: true,
      publishedBy: input.publishedBy || "system",
    },
    select: { id: true, version: true },
  });

  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { publishedVersionId: row.id },
  });

  return { versionId: row.id, versionNumber: row.version };
}

/** Load config for an in-progress call — pinned version first. */
export async function loadVoiceAgentConfigForCall(input: {
  workspaceId: string;
  agentId: string;
  agentVersionId?: string | null;
}): Promise<{ config: VoiceAgentConfig; agentVersionId: string | null; source: "pinned" | "published" | "draft" }> {
  const prisma = getPrisma();
  const { parseVoiceAgentConfig } = await import("@/lib/voice/types");

  if (input.agentVersionId) {
    const pinned = await prisma.voiceAgentVersion.findFirst({
      where: { id: input.agentVersionId, agentId: input.agentId, workspaceId: input.workspaceId },
      select: { config: true },
    });
    if (pinned?.config) {
      return {
        config: parseVoiceAgentConfig(pinned.config),
        agentVersionId: input.agentVersionId,
        source: "pinned",
      };
    }
  }

  const { loadVoiceAgentRuntimeConfig } = await import("@/lib/voice/load-agent-config");
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { publishedVersionId: true },
  });
  const config = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  return {
    config,
    agentVersionId: agent?.publishedVersionId || null,
    source: agent?.publishedVersionId ? "published" : "draft",
  };
}

export function realEstateCallConfigStamp(config: VoiceAgentConfig): Record<string, unknown> {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return {
    templateKey: advanced.templateKey || null,
    templateVersion: advanced.templateVersion || null,
    agentConfigVersion: advanced.configVersion || null,
    realEstateCompiled: advanced.realEstateCompiled || null,
    realEstateSpeedToLeadCompiled: advanced.realEstateSpeedToLeadCompiled || null,
  };
}
