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

  const updated = await prisma.voiceAgent.update({
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

  if (patch.phoneNumberId !== undefined) {
    const { syncVoiceAgentPhoneAssignment } = await import("./agent-phone");
    await syncVoiceAgentPhoneAssignment({
      workspaceId,
      agentId,
      phoneNumberId: patch.phoneNumberId,
    });
  }

  return updated;
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

  // Gate public publish when regression suite has a failing result (or hard-require when env set).
  const requireSuite = process.env.VOICE_PUBLISH_REQUIRE_SUITE === "1";
  const latestSuiteRun = await prisma.voiceAssistantTestRun.findFirst({
    where: {
      workspaceId,
      suiteName: "transovo-default",
    },
    orderBy: { createdAt: "desc" },
  });
  const suiteFailed =
    latestSuiteRun &&
    ["failed", "error", "fail"].includes(String(latestSuiteRun.status).toLowerCase());
  if (suiteFailed) {
    throw new Error(
      "Publish blocked: latest transovo-default suite run failed — fix tests or clear the failing run",
    );
  }
  if (requireSuite && !latestSuiteRun) {
    throw new Error(
      "Publish blocked: VOICE_PUBLISH_REQUIRE_SUITE=1 and no suite run found — run seed_suite/run_suite first",
    );
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
      testStatus: latestSuiteRun?.status || (requireSuite ? "required" : "skipped"),
      deploymentStatus: "publishing",
      isMain: true,
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

  // Keep inbound DID join table in sync with the agent's primary number.
  try {
    const { syncVoiceAgentPhoneAssignment } = await import("./agent-phone");
    await syncVoiceAgentPhoneAssignment({
      workspaceId,
      agentId,
      phoneNumberId: updated.phoneNumberId,
    });
  } catch (err) {
    console.error("[voice] phone assignment sync failed", err);
  }

  // Sync Telnyx assistant when configured
  try {
    const { syncTelnyxAssistant } = await import("./telnyx/assistant-sync");
    const sync = await syncTelnyxAssistant(workspaceId, updated, config);
    const assistantId =
      (sync as { assistantId?: string })?.assistantId || updated.telnyxAssistantId;
    if (assistantId) {
      const { enrichAssistantRemoteConfig } = await import("./platform/ai-platform");
      await enrichAssistantRemoteConfig({
        workspaceId,
        agentId,
        telnyxAssistantId: assistantId,
      }).catch((err) =>
        console.warn(
          "[voice] enrich remote config failed",
          err instanceof Error ? err.message : err,
        ),
      );
    }
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

export async function rollbackVoiceAgent(
  workspaceId: string,
  agentId: string,
  versionId: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const version = await prisma.voiceAgentVersion.findFirst({
    where: { id: versionId, agentId, workspaceId },
  });
  if (!version) throw new Error("Version not found");

  const config = parseVoiceAgentConfig(version.config);
  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      draftConfig: config as object,
      status: "DRAFT",
    },
  });

  // Re-publish the rolled-back config so Telnyx stays in sync.
  return publishVoiceAgent(workspaceId, agentId, "rollback");
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
