import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.trim()) {
  console.log("test-routing-resolve-e164: SKIP (DATABASE_URL unset)");
  process.exit(0);
}

const e164 = process.argv.find((a) => a.startsWith("+")) || "+15717491685";
const prisma = new PrismaClient();

async function resolve(dialed) {
  const digits = dialed.replace(/\D/g, "");
  const normalized = dialed.startsWith("+") ? `+${digits}` : `+${digits}`;

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: normalized, status: "Active" },
  });
  if (!phone) return null;

  const assignment = await prisma.voiceAgentPhoneNumber.findFirst({
    where: {
      workspaceId: phone.workspaceId,
      phoneNumberId: phone.id,
      inboundEnabled: true,
      agent: {
        agentType: "appointment_receptionist",
        archivedAt: null,
        status: { in: ["ACTIVE", "TESTING"] },
      },
    },
    include: { agent: true },
    orderBy: { isDefault: "desc" },
  });
  if (!assignment) return null;
  return {
    workspaceId: phone.workspaceId,
    agentId: assignment.agentId,
    phoneNumberId: phone.id,
    publishedVersionId: assignment.agent.publishedVersionId,
    agentStatus: assignment.agent.status,
  };
}

const assigned = await resolve(e164);
const unassigned = await resolve("+19998887777");
console.log(JSON.stringify({ e164, assigned, unassigned }, null, 2));
await prisma.$disconnect();
