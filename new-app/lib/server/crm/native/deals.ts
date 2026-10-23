import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, assertCrmWrite } from "./permissions";

const DEFAULT_STAGES = [
  { name: "Qualification", sortOrder: 0 },
  { name: "Proposal", sortOrder: 1 },
  { name: "Negotiation", sortOrder: 2 },
  { name: "Closed won", sortOrder: 3, isClosedWon: true },
  { name: "Closed lost", sortOrder: 4, isClosedLost: true },
];

export async function ensureDefaultDealStages(workspaceId: string) {
  const prisma = getPrisma();
  const count = await prisma.crmDealStage.count({ where: { workspaceId } });
  if (count > 0) return prisma.crmDealStage.findMany({ where: { workspaceId }, orderBy: { sortOrder: "asc" } });
  await prisma.crmDealStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({
      workspaceId,
      name: s.name,
      sortOrder: s.sortOrder,
      isClosedWon: Boolean(s.isClosedWon),
      isClosedLost: Boolean(s.isClosedLost),
    })),
  });
  return prisma.crmDealStage.findMany({ where: { workspaceId }, orderBy: { sortOrder: "asc" } });
}

export async function listDealsBoard(workspaceId: string) {
  await assertCrmRead(workspaceId);
  const stages = await ensureDefaultDealStages(workspaceId);
  const prisma = getPrisma();
  const deals = await prisma.crmDeal.findMany({
    where: { workspaceId },
    include: {
      stage: true,
      contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return { stages, deals };
}

export async function createDeal(
  workspaceId: string,
  input: {
    title: string;
    stageId?: string;
    contactId?: string;
    companyId?: string;
    amountCents?: number;
    ownerUserId?: string;
    closeTargetAt?: string;
    nextStep?: string;
  },
) {
  await assertCrmWrite(workspaceId);
  const stages = await ensureDefaultDealStages(workspaceId);
  const stageId = input.stageId || stages[0]?.id;
  if (!stageId) throw new Error("No deal stages configured");
  const prisma = getPrisma();
  return prisma.crmDeal.create({
    data: {
      workspaceId,
      title: input.title.trim(),
      stageId,
      contactId: input.contactId || null,
      companyId: input.companyId || null,
      amountCents: input.amountCents ?? null,
      ownerUserId: input.ownerUserId || null,
      closeTargetAt: input.closeTargetAt ? new Date(input.closeTargetAt) : null,
      nextStep: input.nextStep?.trim() || null,
    },
    include: { stage: true },
  });
}

export async function moveDealStage(workspaceId: string, dealId: string, stageId: string) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, workspaceId } });
  if (!deal) throw new Error("Deal not found");
  const stage = await prisma.crmDealStage.findFirst({ where: { id: stageId, workspaceId } });
  if (!stage) throw new Error("Stage not found");
  return prisma.crmDeal.update({
    where: { id: dealId },
    data: { stageId },
    include: { stage: true },
  });
}

export async function patchDeal(
  workspaceId: string,
  dealId: string,
  input: Partial<{
    title: string;
    amountCents: number | null;
    ownerUserId: string | null;
    closeTargetAt: string | null;
    nextStep: string | null;
    contactId: string | null;
    companyId: string | null;
  }>,
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, workspaceId } });
  if (!deal) throw new Error("Deal not found");
  return prisma.crmDeal.update({
    where: { id: dealId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.closeTargetAt !== undefined
        ? { closeTargetAt: input.closeTargetAt ? new Date(input.closeTargetAt) : null }
        : {}),
      ...(input.nextStep !== undefined ? { nextStep: input.nextStep } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
    },
    include: { stage: true, contact: true, company: true },
  });
}

export async function upsertDealStages(
  workspaceId: string,
  stages: { id?: string; name: string; sortOrder: number; isClosedWon?: boolean; isClosedLost?: boolean }[],
) {
  await assertCrmWrite(workspaceId);
  if (!stages.length) throw new Error("At least one stage required");
  const prisma = getPrisma();
  const out = [];
  for (const s of stages) {
    if (s.id) {
      out.push(
        await prisma.crmDealStage.update({
          where: { id: s.id },
          data: {
            name: s.name.trim(),
            sortOrder: s.sortOrder,
            isClosedWon: Boolean(s.isClosedWon),
            isClosedLost: Boolean(s.isClosedLost),
          },
        }),
      );
    } else {
      out.push(
        await prisma.crmDealStage.create({
          data: {
            workspaceId,
            name: s.name.trim(),
            sortOrder: s.sortOrder,
            isClosedWon: Boolean(s.isClosedWon),
            isClosedLost: Boolean(s.isClosedLost),
          },
        }),
      );
    }
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}
