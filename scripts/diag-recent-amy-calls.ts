import { getPrisma } from "../src/lib/db";

const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 8,
    select: {
      id: true,
      startedAt: true,
      status: true,
      fromE164: true,
      toE164: true,
      telnyxConversationId: true,
      telnyxCallControlId: true,
    },
  });

  console.log("=== Recent Amy calls ===");
  for (const c of calls) {
    console.log(JSON.stringify(c, null, 0));
  }

  const execs = await prisma.voiceToolExecution.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      createdAt: { gte: since },
      OR: [
        { callId: { in: calls.map((c) => c.id) } },
        { input: { path: ["toolType"], string_contains: "continue" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      createdAt: true,
      status: true,
      errorMessage: true,
      input: true,
      output: true,
      callId: true,
    },
  });

  console.log("\n=== Tool executions ===");
  for (const e of execs) {
    const input = e.input as { toolType?: string };
    const out = e.output as { error_code?: string; speak?: string; error?: string };
    console.log(
      JSON.stringify({
        at: e.createdAt.toISOString(),
        tool: input?.toolType,
        status: e.status,
        err: e.errorMessage,
        code: out?.error_code,
        speak: out?.speak?.slice(0, 100),
        callId: e.callId,
      }),
    );
  }

  const ingress = await prisma.providerWebhookEvent.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      createdAt: { gte: since },
      eventType: { contains: "voice.tool" },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      createdAt: true,
      eventType: true,
      payload: true,
      status: true,
    },
  });

  console.log("\n=== Tool webhook ingress ===");
  for (const row of ingress) {
    const p = row.payload as Record<string, unknown>;
    const body = (p?.body || p) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        at: row.createdAt.toISOString(),
        type: row.eventType,
        status: row.status,
        toolType: p?.toolType || body?.toolType,
        error: p?.error || body?.error,
        errorCode: p?.error_code || body?.error_code,
      }),
    );
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: {
      id: true,
      name: true,
      telnyxAssistantId: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  if (agent) {
    const adv = (agent.draftConfig as { advanced?: Record<string, unknown> })?.advanced || {};
    const pub = agent.publishedVersionId
      ? await prisma.voiceAgentVersion.findFirst({
          where: { id: agent.publishedVersionId },
          select: { version: true, config: true },
        })
      : null;
    const pubAdv = (pub?.config as { advanced?: Record<string, unknown> })?.advanced || {};
    console.log("\n=== Agent publish state ===");
    console.log(
      JSON.stringify(
        {
          name: agent.name,
          telnyxAssistantId: agent.telnyxAssistantId,
          publishedVersion: pub?.version,
          draft: {
            conversationWorkflow: adv.conversationWorkflowMode,
            minimumSideEffect: adv.minimumSideEffectMode,
            arch: adv.voiceArchitectureVersion,
          },
          published: {
            conversationWorkflow: pubAdv.conversationWorkflowMode,
            minimumSideEffect: pubAdv.minimumSideEffectMode,
            arch: pubAdv.voiceArchitectureVersion,
          },
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    await prisma.$disconnect();
  });
