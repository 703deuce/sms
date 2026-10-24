import { PrismaClient } from "@prisma/client";

const ws = process.env.WS?.trim();
if (!ws) {
  console.error("WS required");
  process.exit(1);
}
const prisma = new PrismaClient();
const agent = await prisma.voiceAgent.findFirst({
  where: { workspaceId: ws, publishedVersionId: { not: null } },
  select: { id: true },
  orderBy: { updatedAt: "desc" },
});
console.log(JSON.stringify({ agentId: agent?.id ?? null }));
await prisma.$disconnect();
