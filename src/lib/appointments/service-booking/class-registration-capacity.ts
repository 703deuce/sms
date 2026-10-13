import "server-only";

import { createHash } from "crypto";
import { getPrisma, type DbRow } from "@/lib/db";

export const DEFAULT_CLASS_REGISTRATION_HOLD_MINUTES = 15;

function occurrenceLockId(occurrenceId: string): bigint {
  const hash = createHash("sha256").update(`class-occ|${occurrenceId}`).digest();
  return hash.readBigInt64BE(0);
}

export async function countActiveRegistrationHolds(
  occurrenceId: string,
  tx?: DbRow,
): Promise<number> {
  const prisma = tx ?? getPrisma();
  const now = new Date();
  return prisma.classOccurrenceRegistrationHold.count({
    where: {
      occurrenceId,
      status: "active",
      expiresAt: { gt: now },
    },
  });
}

export async function assertOccurrenceCapacityWithHolds(
  workspaceId: string,
  occurrenceId: string,
  tx?: DbRow,
): Promise<{ seriesId: string; capacity: number; enrolled: number; holds: number }> {
  const prisma = tx ?? getPrisma();
  const occ = await prisma.classOccurrence.findFirst({
    where: { id: occurrenceId, workspaceId, status: "scheduled" },
    include: { series: true },
  });
  if (!occ) throw new Error("Occurrence not found or not open for registration");
  const cap = occ.capacity ?? occ.series?.capacity ?? 0;
  const enrolled = await prisma.classEnrollment.count({
    where: { workspaceId, occurrenceId, status: "enrolled" },
  });
  const holds = await countActiveRegistrationHolds(occurrenceId, prisma);
  if (enrolled + holds >= cap) {
    throw new Error("This session is full");
  }
  return { seriesId: String(occ.seriesId), capacity: cap, enrolled, holds };
}

/** Create a temporary hold while checkout completes (Phase 1b). */
export async function createClassRegistrationHold(input: {
  workspaceId: string;
  occurrenceId: string;
  contactId?: string;
  stripeCheckoutSessionId?: string;
  holdMinutes?: number;
}) {
  const prisma = getPrisma();
  const minutes = input.holdMinutes ?? DEFAULT_CLASS_REGISTRATION_HOLD_MINUTES;
  const expiresAt = new Date(Date.now() + minutes * 60_000);

  return prisma.$transaction(async (tx: DbRow) => {
    const lock = occurrenceLockId(input.occurrenceId);
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
    }
    await assertOccurrenceCapacityWithHolds(input.workspaceId, input.occurrenceId, tx);
    return tx.classOccurrenceRegistrationHold.create({
      data: {
        workspaceId: input.workspaceId,
        occurrenceId: input.occurrenceId,
        contactId: input.contactId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        status: "active",
        expiresAt,
      },
    });
  });
}

export async function consumeClassRegistrationHold(
  holdId: string,
  enrollmentId: string,
) {
  const prisma = getPrisma();
  return prisma.classOccurrenceRegistrationHold.update({
    where: { id: holdId },
    data: {
      status: "consumed",
      metadata: { enrollmentId, consumedAt: new Date().toISOString() },
    },
  });
}

export async function releaseClassRegistrationHold(holdId: string) {
  const prisma = getPrisma();
  return prisma.classOccurrenceRegistrationHold.update({
    where: { id: holdId },
    data: { status: "released", fulfillmentOutcome: "released" },
  });
}

/** Payment succeeded but enrollment could not complete — queue recovery (no live refund in tests). */
export async function recordClassCheckoutFulfillmentFailure(input: {
  holdId?: string;
  stripeCheckoutSessionId?: string;
  reason: string;
  recovery: "refund_pending" | "manual_review";
}) {
  const prisma = getPrisma();
  const row = input.holdId
    ? await prisma.classOccurrenceRegistrationHold.findUnique({ where: { id: input.holdId } })
    : input.stripeCheckoutSessionId
      ? await prisma.classOccurrenceRegistrationHold.findFirst({
          where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
        })
      : null;
  if (!row) return null;
  return prisma.classOccurrenceRegistrationHold.update({
    where: { id: row.id },
    data: {
      status: "failed_fulfillment",
      fulfillmentOutcome: input.recovery,
      metadata: {
        ...(typeof row.metadata === "object" && row.metadata ? row.metadata : {}),
        failureReason: input.reason,
        failedAt: new Date().toISOString(),
      },
    },
  });
}

export async function expireStaleClassRegistrationHolds(workspaceId?: string) {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.classOccurrenceRegistrationHold.updateMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status: "active",
      expiresAt: { lte: now },
    },
    data: { status: "expired", fulfillmentOutcome: "expired" },
  });
}

export async function enrollInOccurrenceWithCapacityLock(
  workspaceId: string,
  input: {
    occurrenceId: string;
    seriesId: string;
    contactId: string;
  },
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx: DbRow) => {
    const lock = occurrenceLockId(input.occurrenceId);
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
    }
    await assertOccurrenceCapacityWithHolds(workspaceId, input.occurrenceId, tx);
    return tx.classEnrollment.create({
      data: {
        workspaceId,
        occurrenceId: input.occurrenceId,
        seriesId: input.seriesId,
        contactId: input.contactId,
        status: "enrolled",
      },
    });
  });
}
