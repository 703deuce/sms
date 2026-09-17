#!/usr/bin/env tsx
/**
 * Remove all Voice AI agent rows for one workspace (DB only — does not delete Telnyx assistants).
 *
 * Dry run (default):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/purge-workspace-voice-agents.ts --workspace <id>
 *
 * Execute:
 *   CONFIRM_PURGE=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/purge-workspace-voice-agents.ts --workspace <id>
 */
import "./preload-server-only.mjs";

import { getPrisma } from "@/lib/db";

function argWorkspace(): string {
  const i = process.argv.indexOf("--workspace");
  const id = i >= 0 ? process.argv[i + 1] : process.env.WORKSPACE_ID;
  if (!id?.trim()) {
    console.error("Usage: --workspace <workspaceId>  (or WORKSPACE_ID=...)");
    process.exit(1);
  }
  return id.trim();
}

async function main() {
  const workspaceId = argWorkspace();
  const confirm = process.env.CONFIRM_PURGE === "1";
  const prisma = getPrisma();

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, telnyxAssistantId: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  console.info(`Workspace ${workspaceId}: ${agents.length} voice agent(s)`);
  for (const a of agents) {
    console.info(
      `  - ${a.id}  ${a.name}  status=${a.status}  telnyx=${a.telnyxAssistantId ?? "—"}`,
    );
  }

  if (!confirm) {
    console.info("\nDry run only. Set CONFIRM_PURGE=1 to delete these rows (+ related call history for workspace).");
    return;
  }

  if (!agents.length) {
    console.info("Nothing to delete.");
    return;
  }

  // Order matches test harness cleanup — calls must go before agents when FK requires it.
  await prisma.voiceUsageRecord.deleteMany({ where: { workspaceId } });
  await prisma.voiceConversationInsight.deleteMany({ where: { workspaceId } });
  await prisma.voiceTranscript.deleteMany({ where: { workspaceId } });
  await prisma.voiceCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.voiceCall.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentVersion.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentPhoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentKnowledgeBase.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentTool.deleteMany({ where: { workspaceId } });
  const deleted = await prisma.voiceAgent.deleteMany({ where: { workspaceId } });

  console.info(`Deleted ${deleted.count} voice agent(s) and related workspace voice call rows.`);
  console.info("Telnyx assistants/DIDs were NOT removed — clean those in Telnyx or via Numbers UI when you provision the new line.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
