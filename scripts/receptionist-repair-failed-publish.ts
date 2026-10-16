/**
 * One-off repair: agent stuck DRAFT + health error but publishedVersionId still set.
 * Usage: npx tsx scripts/receptionist-repair-failed-publish.ts <agentId>
 */
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";

const AGENT = process.argv[2] || "cmu42zyel1c4x01090c6s335z";

async function main() {
  if (!hydrateProdDatabaseUrlFromCoolify()) throw new Error("no DATABASE_URL");
  hydrateProdSupabaseFromCoolify();
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT },
    select: {
      id: true,
      status: true,
      healthStatus: true,
      healthMessage: true,
      publishedVersionId: true,
    },
  });
  if (!agent) throw new Error("agent not found");
  if (agent.status === "ACTIVE" && agent.healthStatus === "ok") {
    console.log(JSON.stringify({ skipped: true, reason: "agent_healthy_active" }));
    return;
  }
  if (!agent.publishedVersionId) {
    console.log(JSON.stringify({ skipped: true, reason: "no_published_version_pointer" }));
    return;
  }
  const versionId = agent.publishedVersionId;
  await prisma.voiceAgentVersion.update({
    where: { id: versionId },
    data: { deploymentStatus: "rolled_back", isMain: false },
  });
  await prisma.voiceAgent.update({
    where: { id: AGENT },
    data: { publishedVersionId: null },
  });
  console.log(
    JSON.stringify({
      repaired: true,
      agentId: AGENT,
      rolledBackVersionId: versionId,
      priorHealth: agent.healthMessage,
    }),
  );
}

main();
