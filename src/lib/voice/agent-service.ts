import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "./types";
import { validateAgentForPublish, hasBlockingIssues } from "./validation";
import { templateConfig } from "./templates";

export async function createVoiceAgent(
  workspaceId: string,
  input: {
    name: string;
    agentType?: string;
    templateId?: string;
    description?: string;
  },
) {
  const prisma = getPrisma();
  const config = input.templateId
    ? templateConfig(input.templateId)
    : parseVoiceAgentConfig(null);

  return prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      agentType: input.agentType || input.templateId || "custom",
      description: input.description,
      draftConfig: config as object,
      status: "DRAFT",
    },
  });
}

export async function updateVoiceAgentDraft(
  workspaceId: string,
  agentId: string,
  patch: {
    name?: string;
    description?: string;
    agentType?: string;
    displayName?: string;
    purpose?: string;
    phoneNumberId?: string | null;
    status?: string;
    draftConfig?: VoiceAgentConfig;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!existing) throw new Error("Agent not found");

  const prevConfig = parseVoiceAgentConfig(existing.draftConfig);
  const nextConfig = patch.draftConfig
    ? { ...prevConfig, ...patch.draftConfig }
    : prevConfig;

  return prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      name: patch.name?.trim() || undefined,
      description: patch.description ?? undefined,
      agentType: patch.agentType || undefined,
      displayName: patch.displayName ?? undefined,
      purpose: patch.purpose ?? undefined,
      phoneNumberId:
        patch.phoneNumberId === null ? null : patch.phoneNumberId || undefined,
      status: patch.status || undefined,
      draftConfig: nextConfig as object,
      updatedAt: new Date(),
    },
  });
}

export async function publishVoiceAgent(
  workspaceId: string,
  agentId: string,
  publishedBy?: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const issues = validateAgentForPublish(agent.name, config, {
    requirePhone: config.identity?.directions?.includes("inbound"),
    phoneNumberId: agent.phoneNumberId,
  });
  if (hasBlockingIssues(issues)) {
    const err = new Error("Publish validation failed");
    (err as Error & { issues: typeof issues }).issues = issues;
    throw err;
  }

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId,
      version,
      config: config as object,
      publishedBy,
    },
  });

  const updated = await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      publishedVersionId: versionRow.id,
      status: "ACTIVE",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  // Sync Telnyx assistant when configured
  try {
    const { syncTelnyxAssistant } = await import("./telnyx/assistant-sync");
    await syncTelnyxAssistant(workspaceId, updated, config);
  } catch (err) {
    console.error("[voice] Telnyx assistant sync failed", err);
    await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        healthStatus: "warning",
        healthMessage: "Published locally but Telnyx sync failed",
      },
    });
  }

  return { agent: updated, version: versionRow };
}

export async function duplicateVoiceAgent(workspaceId: string, agentId: string) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  return prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: `${agent.name} (copy)`,
      description: agent.description,
      agentType: agent.agentType,
      displayName: agent.displayName,
      purpose: agent.purpose,
      draftConfig: agent.draftConfig as object,
      status: "DRAFT",
    },
  });
}

export async function getPublishedConfig(
  agentId: string,
): Promise<VoiceAgentConfig | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!agent?.publishedVersionId) return null;
  const ver = await prisma.voiceAgentVersion.findUnique({
    where: { id: agent.publishedVersionId },
  });
  if (!ver) return null;
  return parseVoiceAgentConfig(ver.config);
}
