import "server-only";

import { getPrisma } from "@/lib/db";

export async function transferAppointmentEntitlements(
  workspaceId: string,
  fromAppointmentId: string,
  toAppointmentId: string,
) {
  const prisma = getPrisma();
  await prisma.packageLedgerEntry.updateMany({
    where: { appointmentId: fromAppointmentId },
    data: { appointmentId: toAppointmentId },
  });
  await prisma.giftCertificateLedgerEntry.updateMany({
    where: { appointmentId: fromAppointmentId },
    data: { appointmentId: toAppointmentId },
  });
  return { workspaceId, fromAppointmentId, toAppointmentId };
}

export async function listEligibleEntitlementsForContact(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const [packages, gifts, memberships] = await Promise.all([
    prisma.packageBalance.findMany({
      where: { workspaceId, contactId, status: "active" },
      include: { product: true },
    }),
    prisma.giftCertificateBalance.findMany({
      where: { workspaceId, status: "active", balanceCents: { gt: 0 } },
    }),
    prisma.serviceMembershipSubscription.findMany({
      where: { workspaceId, contactId, status: { in: ["active", "past_due"] } },
      include: { product: true },
    }),
  ]);
  return { packages, gifts, memberships };
}

export async function redeemPackageCredit(
  balanceId: string,
  bookingTypeId: string,
  appointmentId: string,
  creditKey = "default",
) {
  const prisma = getPrisma();
  const balance = await prisma.packageBalance.findUnique({ where: { id: balanceId } });
  if (!balance || balance.status !== "active") throw new Error("Invalid package balance");

  const remaining = (balance.remainingCredits || {}) as Record<string, number>;
  const current = remaining[creditKey] ?? remaining.default ?? 0;
  if (current <= 0) throw new Error("No package credits remaining");

  const next = { ...remaining, [creditKey]: current - 1 };
  await prisma.packageBalance.update({
    where: { id: balanceId },
    data: { remainingCredits: next },
  });
  await prisma.packageLedgerEntry.create({
    data: {
      balanceId,
      kind: "redeem",
      delta: { [creditKey]: -1 },
      appointmentId,
      note: `Redeemed for booking type ${bookingTypeId}`,
    },
  });
  return { balanceId, remaining: next };
}
