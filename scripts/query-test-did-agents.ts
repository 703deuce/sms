import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const links = await prisma.voiceAgentPhoneNumber.findMany({
    where: { phoneNumber: { e164: "+18663221763" } },
    include: {
      agent: { select: { id: true, name: true, status: true, workspaceId: true } },
      phoneNumber: { select: { e164: true } },
    },
  });
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: "cmsi5cc2f156i0q0v38434g4l" },
    select: { id: true, name: true, status: true, phoneNumberId: true },
    take: 10,
  });
  console.log(JSON.stringify({ links, agents }, null, 2));
}

main();
