import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const e164 = "+15714073615";

async function main() {
  const phones = await prisma.phoneNumber.findMany({
    where: { e164: { contains: "5714073615" } },
    select: { id: true, e164: true, workspaceId: true, status: true, settingsJson: true },
  });
  console.log("phones", JSON.stringify(phones, null, 2));
  for (const p of phones) {
    const telephony = p.settingsJson?.telephony;
    console.log("telephony", JSON.stringify(telephony, null, 2));
    const receptionist = await prisma.voiceAgent.findMany({
      where: { workspaceId: p.workspaceId, agentType: "RECEPTIONIST" },
      select: {
        id: true,
        status: true,
        publishedVersionId: true,
        phoneNumberId: true,
        healthMessage: true,
        updatedAt: true,
      },
    });
    const assign = await prisma.voiceAgentPhoneNumber.findMany({
      where: { phoneNumberId: p.id },
      include: {
        agent: { select: { agentType: true, status: true, publishedVersionId: true, name: true } },
      },
    });
    const routing = await prisma.workspaceCallRouting.findUnique({ where: { workspaceId: p.workspaceId } });
    console.log(
      "routing",
      JSON.stringify(
        {
          receptionist,
          assign,
          providerSync: routing?.providerSyncStatus,
          providerError: routing?.providerSyncError,
          policy: routing?.policyJson,
        },
        null,
        2,
      ),
    );
  }
  const recent = await prisma.voiceCall.findMany({
    where: { toE164: e164 },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      startedAt: true,
      status: true,
      fromE164: true,
      agentId: true,
      outcome: true,
      durationSeconds: true,
    },
  });
  console.log("recent calls to DID", recent);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
