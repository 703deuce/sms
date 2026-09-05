import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: "ws_1" },
    select: { id: true, name: true, slug: true },
  });
  console.log("workspace", ws);

  const calendly = await prisma.integrationConnection.findFirst({
    where: { workspaceId: "ws_1", provider: "calendly" },
  });
  console.log(
    "calendly",
    calendly ? { status: calendly.status, hasToken: !!calendly.accessToken } : null,
  );

  const services = await prisma.voiceService.findMany({
    where: { workspaceId: "ws_1" },
    select: { id: true, name: true, durationMinutes: true, config: true },
  });
  console.log(
    "voiceServices",
    services.map((s) => ({
      id: s.id,
      name: s.name,
      duration: s.durationMinutes,
      enabled: (s.config as { enabled?: boolean })?.enabled,
    })),
  );

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: "ws_1" },
    select: {
      id: true,
      name: true,
      agentType: true,
      status: true,
      telnyxAssistantId: true,
      draftConfig: true,
    },
  });
  for (const a of agents) {
    const adv = (a.draftConfig as { advanced?: Record<string, unknown> })?.advanced || {};
    console.log("agent", {
      id: a.id,
      name: a.name,
      type: a.agentType,
      status: a.status,
      telnyx: a.telnyxAssistantId,
      conversationWorkflow: adv.conversationWorkflowMode,
      minimumSideEffect: adv.minimumSideEffectMode,
    });
  }

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: "ws_1", status: "Active" },
    select: { id: true, e164: true, settingsJson: true },
  });
  console.log(
    "phones",
    phones.map((p) => ({
      id: p.id,
      e164: p.e164,
      ai: (p.settingsJson as { aiAfterHoursEnabled?: boolean })?.aiAfterHoursEnabled,
    })),
  );

  const assignments = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: "ws_1" },
    include: {
      agent: { select: { id: true, name: true } },
      phoneNumber: { select: { e164: true } },
    },
  });
  console.log(
    "assignments",
    assignments.map((a) => ({
      agent: a.agent.name,
      agentId: a.agentId,
      phone: a.phoneNumber.e164,
    })),
  );
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
