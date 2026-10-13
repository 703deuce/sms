import "server-only";

import { createHash } from "crypto";
import { getPrisma, type DbRow } from "@/lib/db";

export const DEFAULT_CLASS_REGISTRATION_HOLD_MINUTES = 15;

function occurrenceLockId(occurrenceId: string): bigint {
  const hash = createHash("sha256").update(`class-occ|${occurrenceId}`).digest();
  return hash.readBigInt64BE(0);
}

function seriesLockId(seriesId: string): bigint {
  const hash = createHash("sha256").update(`class-series|${seriesId}`).digest();
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
    paymentMetadata?: Record<string, unknown>;
  },
  txOuter?: DbRow,
) {
  const run = async (tx: DbRow) => {
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
        metadata: input.paymentMetadata ?? undefined,
      },
    });
  };
  if (txOuter) return run(txOuter);
  const prisma = getPrisma();
  return prisma.$transaction(run);
}

/** Reserve capacity on every scheduled session before checkout (all-or-nothing). */
export async function createRegistrationHoldsForOccurrences(input: {
  workspaceId: string;
  contactId: string;
  occurrenceIds: string[];
  registrationGroupId: string;
  stripeCheckoutSessionId?: string;
  holdMinutes?: number;
}) {
  const prisma = getPrisma();
  const minutes = input.holdMinutes ?? DEFAULT_CLASS_REGISTRATION_HOLD_MINUTES;
  const expiresAt = new Date(Date.now() + minutes * 60_000);

  return prisma.$transaction(async (tx: DbRow) => {
    const holds = [];
    for (const occurrenceId of input.occurrenceIds) {
      const lock = occurrenceLockId(occurrenceId);
      if (typeof tx.$executeRaw === "function") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
      }
      await assertOccurrenceCapacityWithHolds(input.workspaceId, occurrenceId, tx);
      holds.push(
        await tx.classOccurrenceRegistrationHold.create({
          data: {
            workspaceId: input.workspaceId,
            occurrenceId,
            contactId: input.contactId,
            stripeCheckoutSessionId: input.stripeCheckoutSessionId,
            status: "active",
            expiresAt,
            metadata: { registrationGroupId: input.registrationGroupId },
          },
        }),
      );
    }
    return holds;
  });
}

function holdGroupId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const id = (metadata as { registrationGroupId?: string }).registrationGroupId;
  return id ? String(id) : null;
}

export async function releaseRegistrationHoldsByGroup(registrationGroupId: string) {
  const prisma = getPrisma();
  const active = await prisma.classOccurrenceRegistrationHold.findMany({
    where: { status: "active" },
    take: 500,
  });
  const ids = active.filter((h) => holdGroupId(h.metadata) === registrationGroupId).map((h) => h.id);
  if (!ids.length) return { count: 0 };
  return prisma.classOccurrenceRegistrationHold.updateMany({
    where: { id: { in: ids } },
    data: { status: "released", fulfillmentOutcome: "released" },
  });
}

export async function consumeRegistrationHoldsByGroup(
  registrationGroupId: string,
  enrollmentIds: string[],
) {
  const prisma = getPrisma();
  const holds = await prisma.classOccurrenceRegistrationHold.findMany({
    where: { status: "active" },
    take: 500,
  }).then((rows) => rows.filter((h) => holdGroupId(h.metadata) === registrationGroupId));
  for (let i = 0; i < holds.length; i++) {
    await prisma.classOccurrenceRegistrationHold.update({
      where: { id: holds[i].id },
      data: {
        status: "consumed",
        metadata: {
          ...(typeof holds[i].metadata === "object" && holds[i].metadata
            ? holds[i].metadata
            : {}),
          enrollmentId: enrollmentIds[i] || enrollmentIds[0],
          consumedAt: new Date().toISOString(),
        },
      },
    });
  }
}

/** Enroll in every scheduled session atomically — all sessions or none. */
export async function enrollFullSeriesAtomic(
  workspaceId: string,
  input: { contactId: string; seriesId: string; paymentMetadata?: Record<string, unknown> },
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx: DbRow) => {
    const lock = seriesLockId(input.seriesId);
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
    }
    const occurrences = await tx.classOccurrence.findMany({
      where: { workspaceId, seriesId: input.seriesId, status: "scheduled" },
      orderBy: { startsAt: "asc" },
    });
    if (occurrences.length === 0) throw new Error("No scheduled sessions for this course");

    for (const occ of occurrences) {
      await assertOccurrenceCapacityWithHolds(workspaceId, occ.id, tx);
    }

    const enrollments = [];
    for (const occ of occurrences) {
      enrollments.push(
        await tx.classEnrollment.create({
          data: {
            workspaceId,
            occurrenceId: occ.id,
            seriesId: input.seriesId,
            contactId: input.contactId,
            status: "enrolled",
            metadata: input.paymentMetadata ?? undefined,
          },
        }),
      );
    }
    return enrollments;
  });
}
