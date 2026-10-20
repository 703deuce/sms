/**
 * Repair receptionist → phone assignment (production ops).
 * Dry-run by default; pass --apply to mutate.
 *
 *   npx tsx scripts/repair-receptionist-phone-assignment.mjs --e164 +15717491685 --apply
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const e164Arg = process.argv.find((a) => a.startsWith("+"));

function normalizeE164(phone) {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

const prisma = new PrismaClient();

try {
  if (!e164Arg) throw new Error("Pass --e164 +1XXXXXXXXXX");
  const e164 = normalizeE164(e164Arg);

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164, status: "Active" },
  });
  if (!phone) throw new Error(`No active phone row for ${e164}`);

  const agent = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId: phone.workspaceId,
      agentType: "appointment_receptionist",
      archivedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!agent) throw new Error("No appointment_receptionist agent in workspace");

  const stale = await prisma.voiceAgentPhoneNumber.findMany({
    where: { agentId: agent.id },
  });

  const plan = {
    e164,
    phoneNumberId: phone.id,
    workspaceId: phone.workspaceId,
    agentId: agent.id,
    agentName: agent.name,
    staleAssignments: stale.map((s) => ({ id: s.id, phoneNumberId: s.phoneNumberId })),
    agentPhoneNumberIdBefore: agent.phoneNumberId,
  };

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry_run", plan }, null, 2));

  if (!apply) {
    console.log("No changes (dry-run). Pass --apply to execute.");
    process.exit(0);
  }

  await prisma.voiceAgentPhoneNumber.deleteMany({ where: { agentId: agent.id } });
  await prisma.voiceAgentPhoneNumber.create({
    data: {
      workspaceId: phone.workspaceId,
      agentId: agent.id,
      phoneNumberId: phone.id,
      inboundEnabled: true,
      outboundEnabled: false,
      isDefault: true,
    },
  });

  const draft = agent.draftConfig;
  if (draft && typeof draft === "object" && draft.editor?.connection) {
    draft.editor.connection = { kind: "owned", id: phone.id };
    draft.updatedAt = new Date().toISOString();
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        phoneNumberId: phone.id,
        linkedPhoneNumberIds: [phone.id],
        draftConfig: draft,
      },
    });
  } else {
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: { phoneNumberId: phone.id, linkedPhoneNumberIds: [phone.id] },
    });
  }

  console.log("Repair applied.");
} finally {
  await prisma.$disconnect();
}
