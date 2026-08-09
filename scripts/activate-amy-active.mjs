#!/usr/bin/env node
/**
 * Activate Amy for inbound LiveKit calls without re-running LiveKit SIP provision.
 * Use when the DID is already on livekit_sip and publish fails on missing LIVEKIT_* in CI.
 *
 *   npx tsx scripts/activate-amy-active.mjs
 */
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { persistVoiceWorkflowDefinition } = await import(
    "../src/lib/voice/workflow-runtime/persistence.ts"
  );
  const { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } = await import(
    "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher.ts"
  );
  const { applyFlowToAgentDraft } = await import("../src/lib/voice/flow/apply.ts");
  const { parseVoiceAgentConfig } = await import("../src/lib/voice/types.ts");
  const { syncVoiceAgentPhoneAssignment } = await import("../src/lib/voice/agent-phone.ts");

  const prisma = new PrismaClient();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error("Amy agent not found");

  const transferDest = process.env.VOICE_TRANSFER_FALLBACK_E164?.trim();
  const definition = {
    ...HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    metadata: {
      ...HOME_SERVICE_DISPATCHER_WORKFLOW_V1.metadata,
      ...(transferDest ? { transferDestination: transferDest } : {}),
    },
  };

  console.log("\n=== 1) Persist home_service_dispatcher on draft ===");
  const ref = await persistVoiceWorkflowDefinition({
    workspaceId: WORKSPACE_ID,
    agentId: AMY_AGENT_ID,
    definition,
    setActive: true,
  });
  console.log(ref);

  const refreshed = await prisma.voiceAgent.findUnique({ where: { id: AMY_AGENT_ID } });
  if (!refreshed) throw new Error("Amy agent not found after persist");
  const applied = await applyFlowToAgentDraft({
    workspaceId: WORKSPACE_ID,
    agentId: AMY_AGENT_ID,
    agentType: refreshed.agentType,
    draftConfig: parseVoiceAgentConfig(refreshed.draftConfig),
    strict: false,
  });

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId: AMY_AGENT_ID },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  console.log("\n=== 2) Publish config version (skip LiveKit reprovision) ===");
  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId: WORKSPACE_ID,
      agentId: AMY_AGENT_ID,
      version,
      config: applied.config,
      publishedBy: "activate-amy-active",
      testStatus: "skipped",
      deploymentStatus: "deployed",
      isMain: true,
    },
  });

  await prisma.voiceAgent.update({
    where: { id: AMY_AGENT_ID },
    data: {
      draftConfig: applied.config,
      publishedVersionId: versionRow.id,
      status: "ACTIVE",
      phoneNumberId: PHONE_866_ID,
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  console.log("\n=== 3) Exclusive phone assignment on 866 ===");
  await syncVoiceAgentPhoneAssignment({
    workspaceId: WORKSPACE_ID,
    agentId: AMY_AGENT_ID,
    phoneNumberId: PHONE_866_ID,
    exclusive: true,
  });

  const pn = await prisma.phoneNumber.findUnique({
    where: { id: PHONE_866_ID },
    select: { e164: true },
  });

  console.log("\n=== READY ===");
  console.log(
    JSON.stringify(
      {
        agentId: AMY_AGENT_ID,
        status: "ACTIVE",
        phone: pn?.e164,
        publishedVersion: version,
        workflow: ref,
        transferDestination: transferDest || definition.metadata?.transferDestination,
        note: "Restart transovo-voice-runtime / web container so workers pick up deploy if needed.",
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
