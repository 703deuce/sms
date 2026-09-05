import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const agentId = "cmshz2lc25c622c4i58303501";

  const agent = await prisma.voiceAgent.findUnique({
    where: { id: agentId },
    include: { publishedVersion: true },
  });
  console.log("=== Amy agent ===");
  console.log({
    status: agent?.status,
    telnyxAssistantId: agent?.telnyxAssistantId,
    publishedVersion: agent?.publishedVersion?.version,
    advanced: (agent?.publishedVersion?.config as { advanced?: Record<string, unknown> })?.advanced,
    enabledTools: (agent?.publishedVersion?.config as { enabledBuiltinTools?: string[] })
      ?.enabledBuiltinTools?.slice(0, 15),
  });

  const calls = await prisma.voiceCall.findMany({
    where: { workspaceId: "ws_1", agentId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      status: true,
      fromE164: true,
      toE164: true,
      telnyxConversationId: true,
    },
  });
  console.log("\n=== Recent Amy calls ===");
  console.log(calls);

  for (const call of calls) {
    const events = await prisma.voiceCallEvent.findMany({
      where: { callId: call.id },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { type: true, payload: true, createdAt: true },
    });
    console.log(`\n--- Call ${call.id} (${call.createdAt.toISOString()}) ---`);
    for (const e of events) {
      const p = e.payload as Record<string, unknown>;
      const tool = p.toolType || p.tool || p.action;
      const err = p.error || p.message;
      console.log(
        e.createdAt.toISOString(),
        e.type,
        tool ? `tool=${String(tool)}` : "",
        err ? `err=${String(err).slice(0, 120)}` : "",
        p.result ? `result=${JSON.stringify(p.result).slice(0, 100)}` : "",
      );
    }
  }

  const toolLogs = await prisma.voiceToolInvocation.findMany({
    where: { workspaceId: "ws_1", agentId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      createdAt: true,
      toolType: true,
      status: true,
      error: true,
      resultJson: true,
    },
  }).catch(() => null);

  if (toolLogs) {
    console.log("\n=== Recent tool invocations ===");
    console.log(toolLogs);
  } else {
    console.log("\n(no voiceToolInvocation table or rows)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    await prisma.$disconnect();
  });
