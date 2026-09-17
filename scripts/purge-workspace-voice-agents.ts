#!/usr/bin/env tsx
/**
 * Reset Voice AI in the database: delete all agents + unlink DIDs from inbound AI routing.
 * Does NOT delete the voice product code. Does NOT release numbers from your Telnyx account.
 *
 * Dry run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/purge-workspace-voice-agents.ts --all
 *
 * Execute (your solo tenant — all workspaces that have/had voice agents):
 *   CONFIRM_PURGE=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/purge-workspace-voice-agents.ts --all
 *
 * One workspace:
 *   CONFIRM_PURGE=1 ... --workspace ws_1
 */
import "./preload-server-only.mjs";

import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { mergePhoneCapabilitySettings } from "@/lib/numbers/phone-capabilities";
import { isMctbTexmlIngressLocked } from "@/lib/mctb/sip-ingress/sync";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

async function resolveWorkspaceIds(
  prisma: PrismaClient,
  all: boolean,
  workspaceId: string | null,
): Promise<string[]> {
  if (!all) return [workspaceId!];
  const [fromAgents, fromJoins] = await Promise.all([
    prisma.voiceAgent.findMany({ select: { workspaceId: true } }),
    prisma.voiceAgentPhoneNumber.findMany({ select: { workspaceId: true } }),
  ]);
  return [...new Set([...fromAgents, ...fromJoins].map((r) => r.workspaceId))];
}

async function listAgents(prisma: PrismaClient, workspaceId: string) {
  return prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, telnyxAssistantId: true, status: true, phoneNumberId: true },
    orderBy: { createdAt: "asc" },
  });
}

async function listLinkedDids(prisma: PrismaClient, workspaceId: string) {
  const joins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId },
    include: { agent: { select: { name: true } } },
  });
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  const aiPhones = phones.filter((p) => {
    const caps = asRecord(asRecord(p.settingsJson).capabilities);
    return caps.aiAfterHoursEnabled === true || asRecord(p.settingsJson).aiAfterHoursEnabled === true;
  });
  return { joins, aiPhones };
}

/** Turn off Transovo inbound AI routing on each DID (keeps MCTB TeXML locks intact). */
async function unlinkDidsFromVoiceAgents(prisma: PrismaClient, workspaceId: string) {
  const phones = await prisma.phoneNumber.findMany({ where: { workspaceId } });
  let updated = 0;

  for (const pn of phones) {
    const mctbLocked = isMctbTexmlIngressLocked(pn.settingsJson);
    let next = mergePhoneCapabilitySettings(pn.settingsJson, { aiAfterHoursEnabled: false });
    const telephony = { ...asRecord(next.telephony) };
    delete telephony.explicitDispatch;
    delete telephony.livekitDidDispatchRuleId;
    delete telephony.voiceAgentId;
    delete telephony.telnyxAssistantId;
    delete telephony.publishedAgentId;
    delete telephony.openaiLiveBridgeAgentId;

    if (!mctbLocked) {
      const mode = String(telephony.routingMode || "").toLowerCase();
      if (
        mode.includes("livekit") ||
        mode.includes("realtime") ||
        mode === "call_control" ||
        mode.includes("openai")
      ) {
        delete telephony.routingMode;
      }
    }
    next.telephony = telephony;
    await prisma.phoneNumber.update({
      where: { id: pn.id },
      data: { settingsJson: next },
    });
    updated += 1;
  }

  await prisma.voiceAgentPhoneNumber.deleteMany({ where: { workspaceId } });

  await prisma.automationFlow.updateMany({
    where: { workspaceId, ownerAgentId: { not: null } },
    data: { ownerAgentId: null },
  });

  const pausedDeployments = await prisma.triggerDeployment.updateMany({
    where: {
      workspaceId,
      channel: "voice",
      triggerBlockType: "inbound_call",
      status: "live",
    },
    data: { status: "paused", pausedAt: new Date() },
  });

  return { phonesUpdated: updated, deploymentsPaused: pausedDeployments.count };
}

/** Delete voice-agent domain rows for one workspace (phone number rows stay; routing cleared separately). */
async function purgeWorkspaceVoiceAgents(prisma: PrismaClient, workspaceId: string) {
  const count = await prisma.voiceAgent.count({ where: { workspaceId } });
  if (!count) return 0;

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
  await prisma.voiceTranscriptSegment.deleteMany({ where: { workspaceId } });
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

  const workspaceIds = await resolveWorkspaceIds(prisma, all, workspaceId);
  if (!workspaceIds.length) {
    console.info("No workspaces with voice agents or DID assignments found.");
    return;
  }

  let totalAgents = 0;
  for (const ws of workspaceIds) {
    const agents = await listAgents(prisma, ws);
    const { joins, aiPhones } = await listLinkedDids(prisma, ws);
    totalAgents += agents.length;
    console.info(`\nWorkspace ${ws}: ${agents.length} agent(s), ${joins.length} DID link(s)`);
    for (const a of agents) {
      console.info(
        `  agent ${a.id}  ${a.name}  telnyx=${a.telnyxAssistantId ?? "—"}  phone=${a.phoneNumberId ?? "—"}`,
      );
    }
    for (const j of joins) {
      console.info(`  link phone=${j.phoneNumberId} → agent=${j.agentId} (${j.agent.name})`);
    }
    for (const p of aiPhones) {
      console.info(`  AI-after-hours flag on ${p.e164}`);
    }
  }

  if (!confirm) {
    console.info(
      `\nDry run — ${totalAgents} agent(s) in ${workspaceIds.length} workspace(s).`,
    );
    console.info(
      "CONFIRM_PURGE=1 will delete agents, clear DID→agent links, disable aiAfterHours on numbers (MCTB TeXML locks preserved).",
    );
    return;
  }

  let removed = 0;
  let phonesUpdated = 0;
  let deploymentsPaused = 0;
  for (const ws of workspaceIds) {
    removed += await purgeWorkspaceVoiceAgents(prisma, ws);
    const unlink = await unlinkDidsFromVoiceAgents(prisma, ws);
    phonesUpdated += unlink.phonesUpdated;
    deploymentsPaused += unlink.deploymentsPaused;
  }

  console.info(`\nDone.`);
  console.info(`  Voice agents deleted: ${removed}`);
  console.info(`  Phone numbers cleared of inbound AI routing: ${phonesUpdated}`);
  console.info(`  Live inbound voice trigger deployments paused: ${deploymentsPaused}`);
  console.info(
    "Telnyx may still point a DID at an old Call Control app until you assign a new agent or change routing in Telnyx — numbers are still in your account.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
