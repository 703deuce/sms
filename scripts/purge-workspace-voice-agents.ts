#!/usr/bin/env tsx
/**
 * Purge Voice AI agent data from the database (Telnyx assistants/DIDs are NOT touched).
 *
 * One workspace (dry run):
 *   npx tsx scripts/purge-workspace-voice-agents.ts --workspace <id>
 *
 * One workspace (execute):
 *   CONFIRM_PURGE=1 npx tsx scripts/purge-workspace-voice-agents.ts --workspace <id>
 *
 * Every workspace that has voice agents (dry run):
 *   npx tsx scripts/purge-workspace-voice-agents.ts --all
 *
 * Execute platform-wide agent purge:
 *   CONFIRM_PURGE=1 npx tsx scripts/purge-workspace-voice-agents.ts --all
 */
import "./preload-server-only.mjs";

import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";

function parseArgs(): { all: boolean; workspaceId: string | null } {
  const all = process.argv.includes("--all");
  const i = process.argv.indexOf("--workspace");
  const workspaceId =
    i >= 0 ? process.argv[i + 1]?.trim() || null : process.env.WORKSPACE_ID?.trim() || null;
  if (!all && !workspaceId) {
    console.error("Usage: --workspace <id>  OR  --all");
    process.exit(1);
  }
  return { all, workspaceId };
}

async function listAgents(prisma: PrismaClient, workspaceId: string) {
  return prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, telnyxAssistantId: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Delete voice-agent domain rows for one workspace (keeps PhoneNumber / MCTB / unrelated products). */
async function purgeWorkspaceVoiceAgents(prisma: PrismaClient, workspaceId: string) {
  const agentIds = (
    await prisma.voiceAgent.findMany({
      where: { workspaceId },
      select: { id: true },
    })
  ).map((a) => a.id);

  if (!agentIds.length) return 0;

  // Child / dependent rows (workspace-scoped voice tables).
  await prisma.voiceAssistantTestRun.deleteMany({ where: { workspaceId } });
  await prisma.voiceAssistantTest.deleteMany({ where: { workspaceId } });
  await prisma.voiceTestRun.deleteMany({ where: { workspaceId } });
  await prisma.voiceCanaryDeploy.deleteMany({ where: { workspaceId } });
  await prisma.voiceRemoteAssistantVersion.deleteMany({ where: { workspaceId } });
  await prisma.voiceWidgetConfig.deleteMany({ where: { workspaceId } });
  await prisma.voiceTransferDestination.deleteMany({ where: { workspaceId } });
  await prisma.voiceFailureDiagnostic.deleteMany({ where: { workspaceId } });
  await prisma.voiceObservabilityConfig.deleteMany({ where: { workspaceId } });
  await prisma.voiceScheduledEvent.deleteMany({ where: { workspaceId } });
  await prisma.voiceAssistantTag.deleteMany({ where: { workspaceId } });
  await prisma.voiceAiConversationMessage.deleteMany({ where: { workspaceId } });
  await prisma.voiceAiConversation.deleteMany({ where: { workspaceId } });
  await prisma.voiceMemoryConfig.deleteMany({ where: { workspaceId } });
  await prisma.voiceV2AiCallRecoverySession.deleteMany({ where: { workspaceId } });
  await prisma.voiceV2BookingIdempotency.deleteMany({ where: { workspaceId } });
  await prisma.voiceV2OfferSet.deleteMany({ where: { workspaceId } });
  await prisma.voiceAppointment.deleteMany({ where: { workspaceId } });
  await prisma.voiceTransfer.deleteMany({ where: { workspaceId } });
  await prisma.voiceRecording.deleteMany({ where: { workspaceId } });
  await prisma.voiceToolExecution.deleteMany({ where: { workspaceId } });
  await prisma.voiceConversationInsight.deleteMany({ where: { workspaceId } });
  await prisma.voiceUsageRecord.deleteMany({ where: { workspaceId } });
  await prisma.voiceTranscriptSegment.deleteMany({
    where: { transcript: { workspaceId } },
  });
  await prisma.voiceTranscript.deleteMany({ where: { workspaceId } });
  await prisma.voiceCallLeg.deleteMany({ where: { workspaceId } });
  await prisma.voiceCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.voiceCall.deleteMany({ where: { workspaceId } });
  await prisma.voiceCampaignAttempt.deleteMany({ where: { workspaceId } });
  await prisma.voiceCampaignContact.deleteMany({ where: { workspaceId } });
  await prisma.voiceCampaign.deleteMany({ where: { workspaceId } });
  await prisma.voiceRoutingRule.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentKnowledgeBase.deleteMany({ where: { workspaceId } });
  await prisma.voiceKnowledgeSource.deleteMany({ where: { workspaceId } });
  await prisma.voiceKnowledgeBase.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentTool.deleteMany({ where: { workspaceId } });
  await prisma.voiceTool.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentPhoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentVersion.deleteMany({ where: { workspaceId } });
  const deleted = await prisma.voiceAgent.deleteMany({ where: { workspaceId } });
  return deleted.count;
}

async function main() {
  const { all, workspaceId } = parseArgs();
  const confirm = process.env.CONFIRM_PURGE === "1";
  const prisma = getPrisma();

  const workspaceIds: string[] = all
    ? [
        ...new Set(
          (
            await prisma.voiceAgent.findMany({
              select: { workspaceId: true },
            })
          ).map((r) => r.workspaceId),
        ),
      ]
    : [workspaceId!];

  let totalAgents = 0;
  for (const ws of workspaceIds) {
    const agents = await listAgents(prisma, ws);
    totalAgents += agents.length;
    console.info(`\nWorkspace ${ws}: ${agents.length} voice agent(s)`);
    for (const a of agents) {
      console.info(
        `  - ${a.id}  ${a.name}  status=${a.status}  telnyx=${a.telnyxAssistantId ?? "—"}`,
      );
    }
  }

  if (!confirm) {
    console.info(
      `\nDry run — ${totalAgents} agent(s) across ${workspaceIds.length} workspace(s).`,
    );
    console.info("Set CONFIRM_PURGE=1 to delete (DB only; Telnyx assistants unchanged).");
    return;
  }

  let removed = 0;
  for (const ws of workspaceIds) {
    removed += await purgeWorkspaceVoiceAgents(prisma, ws);
  }

  console.info(`\nDeleted ${removed} voice agent row(s). Telnyx assistants/DIDs were not modified.`);
  console.info("Create a new agent in Transovo and assign your new number when ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
