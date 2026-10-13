import "server-only";

import { getPrisma } from "@/lib/db";

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
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
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
  });
}
