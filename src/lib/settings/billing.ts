import { getPrisma } from "@/lib/db";

export async function getCreditLedger(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.creditLedgerEntry.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function addMockCredits(
  workspaceId: string,
  amountCents: number,
  description?: string,
) {
  const prisma = getPrisma();
  const recent = await prisma.creditLedgerEntry.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const prevBalance = recent?.balanceAfterCents ?? 0;
  const balanceAfterCents = prevBalance + amountCents;

  return prisma.creditLedgerEntry.create({
    data: {
      workspaceId,
      amountCents,
      balanceAfterCents,
      description: description || `Credit purchase $${(amountCents / 100).toFixed(2)}`,
      source: "purchase",
    },
  });
}

export function getStripePortalUrl(workspaceId: string) {
  const stripeCustomerId = process.env.STRIPE_CUSTOMER_ID?.trim();
  if (stripeCustomerId) {
    return `https://billing.stripe.com/p/login/test_${stripeCustomerId}`;
  }
  return null;
}
