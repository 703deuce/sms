/**
 * Remove legacy knowledge-base links and clear OpenAI vector stores from published Ava/runtime.
 *
 *   cd new-app && npx tsx scripts/strip-receptionist-legacy-knowledge.mjs ws_1
 *   Add --apply to mutate (default dry-run).
 */
import { PrismaClient } from "@prisma/client";

const workspaceId = process.argv[2] || "ws_1";
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient();

function clearVectorStoresInConfig(config) {
  if (!config || typeof config !== "object") return { changed: false, config };
  const next = { ...config };
  let changed = false;

  const nest = next.newAppReceptionist;
  if (nest?.runtime && Array.isArray(nest.runtime.openaiFileSearchVectorStoreIds)) {
    if (nest.runtime.openaiFileSearchVectorStoreIds.length > 0) {
      nest.runtime = {
        ...nest.runtime,
        openaiFileSearchVectorStoreIds: [],
      };
      changed = true;
    }
  }

  const voiceV3 = nest?.runtime?.voiceV3?.voiceV3AgentConfig;
  if (voiceV3?.knowledge?.retrieval) {
    const r = voiceV3.knowledge.retrieval;
    if ((r.openaiVectorStoreIds?.length ?? 0) > 0 || (r.knowledgeBaseIds?.length ?? 0) > 0) {
      voiceV3.knowledge.retrieval = {
        ...r,
        enabled: false,
        knowledgeBaseIds: [],
        documentSourceIds: [],
        openaiVectorStoreIds: [],
      };
      changed = true;
    }
  }

  next.newAppReceptionist = nest;
  return { changed, config: next };
}

try {
  const agent = await prisma.voiceAgent.findFirst({
    where: { workspaceId, purpose: "appointment_receptionist" },
    select: { id: true, name: true, publishedVersionId: true },
  });
  if (!agent) {
    console.error("NO_RECEPTIONIST_AGENT", workspaceId);
    process.exit(2);
  }

  const links = await prisma.voiceAgentKnowledgeBase.findMany({
    where: { workspaceId, agentId: agent.id },
    select: { id: true, knowledgeBaseId: true },
  });

  let publishedPatch = null;
  if (agent.publishedVersionId) {
    const version = await prisma.voiceAgentVersion.findUnique({
      where: { id: agent.publishedVersionId },
      select: { id: true, config: true },
    });
    if (version?.config) {
      publishedPatch = clearVectorStoresInConfig(version.config);
    }
  }

  console.log(
    JSON.stringify(
      {
        workspaceId,
        agentId: agent.id,
        agentName: agent.name,
        knowledgeLinksToDelete: links.length,
        linkKnowledgeBaseIds: links.map((l) => l.knowledgeBaseId),
        publishedVersionId: agent.publishedVersionId,
        publishedConfigNeedsVectorClear: publishedPatch?.changed ?? false,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry-run. Pass --apply to delete links and clear published vector store ids.");
    process.exit(0);
  }

  await prisma.voiceAgentKnowledgeBase.deleteMany({
    where: { workspaceId, agentId: agent.id },
  });

  if (agent.publishedVersionId && publishedPatch?.changed) {
    await prisma.voiceAgentVersion.update({
      where: { id: agent.publishedVersionId },
      data: { config: publishedPatch.config },
    });
  }

  console.log("OK — links removed; published runtime vector stores cleared (if any).");
  console.log("Republish from the receptionist UI after deploy for a fresh compile bundle.");
} finally {
  await prisma.$disconnect();
}
