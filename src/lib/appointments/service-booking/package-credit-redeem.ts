import "server-only";

import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";

type RedeemTx = Pick<
  PrismaClient,
  "$transaction" | "packageLedgerEntry" | "packageBalance"
>;

let directPrisma: PrismaClient | null = null;

/** Production Coolify sets DATABASE_URL — use real Postgres transactions for redeem races. */
function getRedeemDb(): RedeemTx {
  if (process.env.DATABASE_URL) {
    if (!directPrisma) {
      const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
      directPrisma = new PrismaClient();
    }
    return directPrisma;
  }
  return getPrisma() as RedeemTx;
}

async function redeemInTransaction(
  tx: Pick<PrismaClient, "packageLedgerEntry" | "packageBalance"> & {
    $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  },
  balanceId: string,
  referenceLabel: string,
  referenceId: string,
  creditKey: string,
  note?: string,
) {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT "id" FROM "package_balances" WHERE "id" = ${balanceId} FOR UPDATE`;
  }

  const existing = await tx.packageLedgerEntry.findFirst({
    where: { balanceId, kind: "redeem", appointmentId: referenceId },
  });
  if (existing) {
    const balance = await tx.packageBalance.findUnique({ where: { id: balanceId } });
    return {
      balanceId,
      duplicate: true as const,
      remaining: (balance?.remainingCredits || {}) as Record<string, number>,
    };
  }

  const balance = await tx.packageBalance.findUnique({ where: { id: balanceId } });
  if (!balance || balance.status !== "active") throw new Error("Invalid package balance");

  const remaining = (balance.remainingCredits || {}) as Record<string, number>;
  const current = remaining[creditKey] ?? remaining.default ?? 0;
  if (current <= 0) throw new Error("No package credits remaining");

  const next = { ...remaining, [creditKey]: current - 1 };
  const exhausted = Object.values(next).every((v) => v <= 0);

  await tx.packageBalance.update({
    where: { id: balanceId },
    data: {
      remainingCredits: next,
      status: exhausted ? "exhausted" : balance.status,
    },
  });
  await tx.packageLedgerEntry.create({
    data: {
      balanceId,
      kind: "redeem",
      delta: { [creditKey]: -1 },
      appointmentId: referenceId,
      note: note || `Redeemed for ${referenceLabel}`,
    },
  });

  return { balanceId, remaining: next };
}

/**
 * Atomic package credit redemption with idempotency per reference (enrollment / appointment).
 */
export async function redeemPackageCreditAtomic(
  balanceId: string,
  referenceLabel: string,
  referenceId: string,
  creditKey = "default",
  note?: string,
) {
  const prisma = getRedeemDb();

  return prisma.$transaction(async (tx) =>
    redeemInTransaction(tx, balanceId, referenceLabel, referenceId, creditKey, note),
  );
}
