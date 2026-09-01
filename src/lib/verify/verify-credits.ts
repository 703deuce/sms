import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

export async function getVerifyCreditBalance(workspaceId: string): Promise<number> {
  const prisma = getPrisma();
  const last = await prisma.verifyCreditLedger.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return last?.balanceAfter ?? 0;
}

export async function appendVerifyCreditLedger(input: {
  workspaceId: string;
  entryType: "purchase" | "use" | "refund" | "adjustment" | "promo";
  amount: number;
  referenceType?: string;
  referenceId?: string;
  stripeSessionId?: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  if (input.idempotencyKey) {
    const existing = await prisma.verifyCreditLedger.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const current = await getVerifyCreditBalance(input.workspaceId);
  const balanceAfter = current + input.amount;
  if (input.entryType === "use" && balanceAfter < 0) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  return prisma.verifyCreditLedger.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      entryType: input.entryType,
      amount: input.amount,
      balanceAfter,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      stripeSessionId: input.stripeSessionId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      metadataJson: (input.metadata || {}) as object,
    },
  });
}

export async function reserveVerifyCredits(input: {
  workspaceId: string;
  credits: number;
  bulkJobId?: string;
  expiresInMinutes?: number;
}) {
  const prisma = getPrisma();
  const balance = await getVerifyCreditBalance(input.workspaceId);
  const activeReservations = await prisma.verifyCreditReservation.findMany({
    where: { workspaceId: input.workspaceId, status: "active" },
  });
  const reserved = activeReservations.reduce((sum: number, r: { reservedCredits: number; consumedCredits: number }) => sum + r.reservedCredits - r.consumedCredits, 0);
  const available = balance - reserved;
  if (input.credits > available) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  const expiresAt = new Date(Date.now() + (input.expiresInMinutes || 60) * 60 * 1000);
  return prisma.verifyCreditReservation.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      bulkJobId: input.bulkJobId,
      reservedCredits: input.credits,
      status: "active",
      expiresAt,
    },
  });
}

export async function consumeReservedCredit(input: {
  reservationId: string;
  workspaceId: string;
  lookupId: string;
}) {
  const prisma = getPrisma();
  const reservation = await prisma.verifyCreditReservation.findFirst({
    where: { id: input.reservationId, workspaceId: input.workspaceId, status: "active" },
  });
  if (!reservation) throw new Error("RESERVATION_NOT_FOUND");

  await appendVerifyCreditLedger({
    workspaceId: input.workspaceId,
    entryType: "use",
    amount: -1,
    referenceType: "lookup",
    referenceId: input.lookupId,
    idempotencyKey: `verify-use:${input.lookupId}`,
    description: "Phone number verification",
  });

  await prisma.verifyCreditReservation.update({
    where: { id: reservation.id },
    data: { consumedCredits: reservation.consumedCredits + 1 },
  });
}

export async function settleVerifyReservation(reservationId: string, workspaceId: string) {
  const prisma = getPrisma();
  const reservation = await prisma.verifyCreditReservation.findFirst({
    where: { id: reservationId, workspaceId },
  });
  if (!reservation) return;
  const unused = reservation.reservedCredits - reservation.consumedCredits;
  await prisma.verifyCreditReservation.update({
    where: { id: reservationId },
    data: { status: "settled" },
  });
  return { unused };
}
