import "server-only";

import { getPrisma } from "@/lib/db";

export async function listLoyaltyPrograms(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.loyaltyProgram.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertLoyaltyProgram(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    pointsPerDollar?: number;
    redeemRateCents?: number;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    pointsPerDollar: input.pointsPerDollar ?? 1,
    redeemRateCents: input.redeemRateCents ?? 100,
    active: input.active ?? true,
    metadata: input.metadata,
  };

  if (input.id) {
    return prisma.loyaltyProgram.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.loyaltyProgram.create({ data: { workspaceId, ...data } });
}

async function getContactPointsBalance(programId: string, contactId: string) {
  const prisma = getPrisma();
  const latest = await prisma.loyaltyLedgerEntry.findFirst({
    where: { programId, contactId },
    orderBy: { createdAt: "desc" },
  });
  return latest?.pointsBalance ?? 0;
}

export async function getLoyaltyBalance(
  workspaceId: string,
  programId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, workspaceId, active: true },
  });
  if (!program) throw new Error("Loyalty program not found");

  const pointsBalance = await getContactPointsBalance(programId, contactId);
  return { program, pointsBalance };
}

export async function earnLoyaltyPoints(
  workspaceId: string,
  programId: string,
  contactId: string,
  input: { points?: number; spendCents?: number; appointmentId?: string; note?: string },
) {
  const prisma = getPrisma();
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, workspaceId, active: true },
  });
  if (!program) throw new Error("Loyalty program not found");

  let points = input.points ?? 0;
  if (input.spendCents != null) {
    points = Math.floor((input.spendCents / 100) * program.pointsPerDollar);
  }
  if (points <= 0) throw new Error("Earned points must be positive");

  const current = await getContactPointsBalance(programId, contactId);
  const pointsBalance = current + points;

  const [entry] = await prisma.$transaction([
    prisma.loyaltyLedgerEntry.create({
      data: {
        programId,
        contactId,
        kind: "earn",
        pointsDelta: points,
        pointsBalance,
        appointmentId: input.appointmentId,
        note: input.note,
      },
    }),
  ]);

  return entry;
}

export async function redeemLoyaltyPoints(
  workspaceId: string,
  programId: string,
  contactId: string,
  points: number,
  input?: { appointmentId?: string; note?: string },
) {
  if (points <= 0) throw new Error("Redeem points must be positive");
  const prisma = getPrisma();
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, workspaceId, active: true },
  });
  if (!program) throw new Error("Loyalty program not found");

  const current = await getContactPointsBalance(programId, contactId);
  if (current < points) throw new Error("Insufficient loyalty points");

  const pointsBalance = current - points;
  return prisma.loyaltyLedgerEntry.create({
    data: {
      programId,
      contactId,
      kind: "redeem",
      pointsDelta: -points,
      pointsBalance,
      appointmentId: input?.appointmentId,
      note: input?.note,
    },
  });
}

export function loyaltyRedeemValueCents(program: { redeemRateCents: number }, points: number) {
  return Math.floor((points / program.redeemRateCents) * 100);
}

export async function listLoyaltyLedger(
  workspaceId: string,
  programId: string,
  contactId: string,
  limit = 50,
) {
  const prisma = getPrisma();
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, workspaceId },
  });
  if (!program) throw new Error("Loyalty program not found");

  return prisma.loyaltyLedgerEntry.findMany({
    where: { programId, contactId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
