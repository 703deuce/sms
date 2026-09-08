import "server-only";

import { getPrisma } from "@/lib/db";

export type PosLineItemInput = {
  kind: string;
  description: string;
  quantity?: number;
  unitPriceCents?: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
};

async function recalculateSessionTotals(sessionId: string) {
  const prisma = getPrisma();
  const lineItems = await prisma.posLineItem.findMany({ where: { sessionId } });
  const subtotalCents = lineItems.reduce(
    (sum: number, item: { totalCents: number }) => sum + item.totalCents,
    0,
  );
  const taxCents = 0;
  const totalCents = subtotalCents + taxCents;

  return prisma.posSession.update({
    where: { id: sessionId },
    data: { subtotalCents, taxCents, totalCents },
    include: { lineItems: true },
  });
}

export async function createPosSession(
  workspaceId: string,
  input?: { contactId?: string; staffUserId?: string; metadata?: Record<string, unknown> },
) {
  const prisma = getPrisma();
  return prisma.posSession.create({
    data: {
      workspaceId,
      contactId: input?.contactId,
      staffUserId: input?.staffUserId,
      metadata: input?.metadata,
      status: "open",
    },
    include: { lineItems: true },
  });
}

export async function getPosSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { lineItems: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new Error("POS session not found");
  return session;
}

export async function listOpenPosSessions(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.posSession.findMany({
    where: { workspaceId, status: "open" },
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function addPosLineItem(
  workspaceId: string,
  sessionId: string,
  input: PosLineItemInput,
) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
  });
  if (!session) throw new Error("Open POS session not found");

  const quantity = input.quantity ?? 1;
  const unitPriceCents = input.unitPriceCents ?? 0;
  const totalCents = quantity * unitPriceCents;

  await prisma.posLineItem.create({
    data: {
      sessionId,
      kind: input.kind,
      description: input.description.trim(),
      quantity,
      unitPriceCents,
      totalCents,
      referenceId: input.referenceId,
      metadata: input.metadata,
    },
  });

  return recalculateSessionTotals(sessionId);
}

export async function removePosLineItem(workspaceId: string, sessionId: string, lineItemId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
  });
  if (!session) throw new Error("Open POS session not found");

  const line = await prisma.posLineItem.findFirst({
    where: { id: lineItemId, sessionId },
  });
  if (!line) throw new Error("Line item not found");

  await prisma.posLineItem.delete({ where: { id: lineItemId } });
  return recalculateSessionTotals(sessionId);
}

export async function checkoutPosSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
    include: { lineItems: true },
  });
  if (!session) throw new Error("Open POS session not found");
  if (session.lineItems.length === 0) throw new Error("Cannot checkout empty cart");

  return prisma.posSession.update({
    where: { id: sessionId },
    data: { status: "checked_out", checkedOutAt: new Date() },
    include: { lineItems: true },
  });
}

export async function voidPosSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.posSession.findFirst({
    where: { id: sessionId, workspaceId, status: "open" },
  });
  if (!session) throw new Error("Open POS session not found");

  return prisma.posSession.update({
    where: { id: sessionId },
    data: { status: "void" },
    include: { lineItems: true },
  });
}
