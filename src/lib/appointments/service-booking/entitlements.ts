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
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { email: true },
  });
  const [packages, gifts, memberships] = await Promise.all([
    prisma.packageBalance.findMany({
      where: { workspaceId, contactId, status: "active" },
      include: { product: true },
    }),
    prisma.giftCertificateBalance.findMany({
      where: {
        workspaceId,
        status: "active",
        balanceCents: { gt: 0 },
        OR: [
          { purchaserContactId: contactId },
          ...(contact?.email ? [{ recipientEmail: contact.email }] : []),
        ],
      },
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
  referenceLabel: string,
  referenceId: string,
  creditKey = "default",
  note?: string,
) {
  const { redeemPackageCreditAtomic } = await import("./package-credit-redeem");
  const result = await redeemPackageCreditAtomic(
    balanceId,
    referenceLabel,
    referenceId,
    creditKey,
    note,
  );
  return { balanceId: result.balanceId, remaining: result.remaining };
}
