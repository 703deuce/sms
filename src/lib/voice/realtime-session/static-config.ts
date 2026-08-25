import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import { loadWorkflowFieldDefinitions, toManifestEntries } from "@/lib/voice/field-runtime/loader";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import type { StaticSessionConfig } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { config: StaticSessionConfig; expiresAt: number }>();

function cacheKey(agentId: string, versionId: string | null): string {
  return `${agentId}:${versionId || "draft"}`;
}

function hashConfig(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

export async function loadStaticSessionConfig(input: {
  workspaceId: string;
  agentId: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<StaticSessionConfig> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  if (!agent) throw new Error("Agent not found");

  const key = cacheKey(agent.id, agent.publishedVersionId);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.config;
  }

  const messaging = await prisma.workspaceMessagingSettings.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { timezone: true },
  });
  const timezone = String(messaging?.timezone || "America/New_York");

  const workflow = input.workflow || "book_appointment";
  const defs = await loadWorkflowFieldDefinitions({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName || undefined,
  });

  const services = await prisma.voiceService.findMany({
    where: { workspaceId: input.workspaceId },
    select: { name: true },
    take: 1,
    orderBy: { name: "asc" },
  });
  const defaultServiceName = services[0]?.name || "Service Visit";

  const configRaw = JSON.stringify({
    agentId: agent.id,
    versionId: agent.publishedVersionId,
    fieldCount: defs.length,
    timezone,
  });
  const config: StaticSessionConfig = {
    configHash: hashConfig(configRaw),
    agentId: agent.id,
    workspaceId: input.workspaceId,
    timezone,
    fieldManifest: toManifestEntries(defs),
    defaultServiceName,
    publishedVersionId: agent.publishedVersionId,
  };

  cache.set(key, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

/** Test helper — clear in-process static config cache */
export function clearStaticConfigCacheForTests(): void {
  cache.clear();
}
