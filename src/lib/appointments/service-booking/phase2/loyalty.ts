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

type ReferralMetadata = {
  referralCodes?: Record<string, string>;
  referrals?: Array<{ code: string; referrerContactId: string; referredContactId: string; at: string }>;
  referrerBonusPoints?: number;
  referredBonusPoints?: number;
};

function readReferralMetadata(program: { metadata: unknown }): ReferralMetadata {
  return ((program.metadata || {}) as ReferralMetadata) || {};
}

export function buildReferralCode(contactId: string): string {
  const compact = contactId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF${compact}${suffix}`;
}

export async function getOrCreateReferralCode(
  workspaceId: string,
  programId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, workspaceId, active: true },
  });
  if (!program) throw new Error("Loyalty program not found");

  const meta = readReferralMetadata(program);
  const existing = Object.entries(meta.referralCodes || {}).find(([, id]) => id === contactId)?.[0];
  if (existing) return { code: existing, programId: program.id };

  let code = buildReferralCode(contactId);
  const codes = { ...(meta.referralCodes || {}) };
  while (codes[code]) code = buildReferralCode(contactId);
  codes[code] = contactId;

  await prisma.loyaltyProgram.update({
    where: { id: program.id },
    data: { metadata: { ...meta, referralCodes: codes } },
  });

  return { code, programId: program.id };
}

export async function processReferralOnPosCheckout(
  workspaceId: string,
  input: { referralCode: string; referredContactId: string; spendCents?: number },
) {
  const prisma = getPrisma();
  const code = input.referralCode.trim().toUpperCase();
  if (!code) return { applied: false as const };

  const program = await prisma.loyaltyProgram.findFirst({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!program) return { applied: false as const };

  const meta = readReferralMetadata(program);
  const referrerContactId = meta.referralCodes?.[code];
  if (!referrerContactId || referrerContactId === input.referredContactId) {
    return { applied: false as const };
  }

  const prior = (meta.referrals || []).some(
    (row) => row.referredContactId === input.referredContactId,
  );
  if (prior) return { applied: false as const, reason: "already_referred" as const };

  const referrerBonus = meta.referrerBonusPoints ?? 100;
  const referredBonus = meta.referredBonusPoints ?? 50;

  await earnLoyaltyPoints(workspaceId, program.id, referrerContactId, {
    points: referrerBonus,
    note: `Referral reward for ${input.referredContactId}`,
  });
  await earnLoyaltyPoints(workspaceId, program.id, input.referredContactId, {
    points: referredBonus,
    note: `Welcome referral bonus (${code})`,
  });

  const referrals = [
    ...(meta.referrals || []),
    {
      code,
      referrerContactId,
      referredContactId: input.referredContactId,
      at: new Date().toISOString(),
    },
  ];

  await prisma.loyaltyProgram.update({
    where: { id: program.id },
    data: { metadata: { ...meta, referrals } },
  });

  return { applied: true as const, programId: program.id, referrerContactId };
}

export async function configureReferralRewards(
  workspaceId: string,
  programId: string,
  input: { referrerBonusPoints?: number; referredBonusPoints?: number },
) {
  const prisma = getPrisma();
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, workspaceId },
  });
  if (!program) throw new Error("Loyalty program not found");
  const meta = readReferralMetadata(program);
  return prisma.loyaltyProgram.update({
    where: { id: program.id },
    data: {
      metadata: {
        ...meta,
        referrerBonusPoints: input.referrerBonusPoints ?? meta.referrerBonusPoints ?? 100,
        referredBonusPoints: input.referredBonusPoints ?? meta.referredBonusPoints ?? 50,
      },
    },
  });
}
