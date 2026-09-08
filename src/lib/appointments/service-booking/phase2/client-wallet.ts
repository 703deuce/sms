import "server-only";

import { getPrisma } from "@/lib/db";

export async function getOrCreateWalletAccount(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const existing = await prisma.clientWalletAccount.findUnique({
    where: { workspaceId_contactId: { workspaceId, contactId } },
    include: { ledger: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (existing) return existing;

  return prisma.clientWalletAccount.create({
    data: { workspaceId, contactId },
    include: { ledger: true },
  });
}

export async function getWalletBalance(workspaceId: string, contactId: string) {
  const account = await getOrCreateWalletAccount(workspaceId, contactId);
  return {
    accountId: account.id,
    balanceCents: account.balanceCents,
    currency: account.currency,
    status: account.status,
  };
}

export async function creditWallet(
  workspaceId: string,
  contactId: string,
  amountCents: number,
  input?: { note?: string; referenceId?: string; kind?: string },
) {
  if (amountCents <= 0) throw new Error("Credit amount must be positive");
  const prisma = getPrisma();
  const account = await getOrCreateWalletAccount(workspaceId, contactId);
  const balanceAfter = account.balanceCents + amountCents;

  const [updated] = await prisma.$transaction([
    prisma.clientWalletAccount.update({
      where: { id: account.id },
      data: { balanceCents: balanceAfter },
    }),
    prisma.clientWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        kind: input?.kind ?? "credit",
        amountCents,
        balanceAfterCents: balanceAfter,
        note: input?.note,
        referenceId: input?.referenceId,
      },
    }),
  ]);

  return updated;
}

export async function debitWallet(
  workspaceId: string,
  contactId: string,
  amountCents: number,
  input?: { note?: string; referenceId?: string; kind?: string },
) {
  if (amountCents <= 0) throw new Error("Debit amount must be positive");
  const prisma = getPrisma();
  const account = await getOrCreateWalletAccount(workspaceId, contactId);
  if (account.balanceCents < amountCents) {
    throw new Error("Insufficient wallet balance");
  }
  const balanceAfter = account.balanceCents - amountCents;

  const [updated] = await prisma.$transaction([
    prisma.clientWalletAccount.update({
      where: { id: account.id },
      data: { balanceCents: balanceAfter },
    }),
    prisma.clientWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        kind: input?.kind ?? "debit",
        amountCents: -amountCents,
        balanceAfterCents: balanceAfter,
        note: input?.note,
        referenceId: input?.referenceId,
      },
    }),
  ]);

  return updated;
}

export async function listWalletLedger(workspaceId: string, contactId: string, limit = 50) {
  const account = await getOrCreateWalletAccount(workspaceId, contactId);
  const prisma = getPrisma();
  return prisma.clientWalletLedgerEntry.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
