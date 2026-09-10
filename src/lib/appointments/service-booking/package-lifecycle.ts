import "server-only";

import { getPrisma } from "@/lib/db";
import type { PackageLifecyclePolicy } from "./types";

export async function getPackageLedgerHistory(balanceId: string) {
  const prisma = getPrisma();
  return prisma.packageLedgerEntry.findMany({
    where: { balanceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function adjustPackageCredits(
  workspaceId: string,
  balanceId: string,
  delta: Record<string, number>,
  note: string,
) {
  const prisma = getPrisma();
  const balance = await prisma.packageBalance.findFirst({
    where: { id: balanceId, workspaceId },
  });
  if (!balance) throw new Error("Package balance not found");

  const remaining = { ...(balance.remainingCredits as Record<string, number>) };
  for (const [key, value] of Object.entries(delta)) {
    remaining[key] = (remaining[key] || 0) + value;
  }
  const exhausted = Object.values(remaining).every((v) => v <= 0);
  const status = exhausted ? "exhausted" : balance.status === "expired" ? "expired" : "active";

  await prisma.packageBalance.update({
    where: { id: balanceId },
    data: { remainingCredits: remaining, status },
  });
  await prisma.packageLedgerEntry.create({
    data: { balanceId, kind: "adjustment", delta, note },
  });
  return { balanceId, remaining, status };
}

export async function resolvePackageLifecyclePolicyForAppointment(
  workspaceId: string,
  appointmentId: string,
): Promise<PackageLifecyclePolicy> {
  const prisma = getPrisma();
  const entry = await prisma.packageLedgerEntry.findFirst({
    where: { appointmentId, kind: "redeem" },
    include: { balance: { include: { product: true } } },
  });
  if (!entry?.balance?.product || entry.balance.workspaceId !== workspaceId) {
    return {};
  }
  const { readPackageLifecyclePolicy } = await import("./packages");
  return readPackageLifecyclePolicy(entry.balance.product.metadata);
}

export async function restorePackageCreditsForAppointment(
  workspaceId: string,
  appointmentId: string,
  reason: "cancel" | "late_cancel" | "no_show",
  policy?: PackageLifecyclePolicy,
) {
  const prisma = getPrisma();
  const entries = await prisma.packageLedgerEntry.findMany({
    where: { appointmentId, kind: "redeem" },
    include: { balance: true },
  });
  if (!entries.length) return { restored: 0 };

  const resolvedPolicy =
    policy || (await resolvePackageLifecyclePolicyForAppointment(workspaceId, appointmentId));

  const shouldRestore =
    reason === "cancel"
      ? resolvedPolicy.restoreCreditsOnCancel !== false
      : reason === "late_cancel"
        ? resolvedPolicy.restoreCreditsOnLateCancel === true
        : resolvedPolicy.restoreCreditsOnNoShow === true;

  if (!shouldRestore) return { restored: 0, skipped: true };

  let restored = 0;
  for (const entry of entries) {
    if (entry.balance.workspaceId !== workspaceId) continue;
    const delta = entry.delta as Record<string, number>;
    const inverse: Record<string, number> = {};
    for (const [k, v] of Object.entries(delta)) {
      inverse[k] = -v;
    }
    await adjustPackageCredits(
      workspaceId,
      entry.balanceId,
      inverse,
      `Restored credits after ${reason}`,
    );
    restored += 1;
  }
  return { restored };
}

export function packageBalanceSummary(remaining: Record<string, number>) {
  const total = Object.values(remaining).reduce((s, n) => s + Math.max(0, n), 0);
  return { totalRemaining: total, exhausted: total <= 0 };
}
