import "server-only";

import { createHash, randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 90;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createEmployeeAccessToken(input: {
  workspaceId: string;
  authorizedCallerId: string;
  label?: string | null;
  ttlDays?: number;
}) {
  const prisma = getPrisma();
  const caller = await prisma.smartRoutingAuthorizedCaller.findFirst({
    where: {
      id: input.authorizedCallerId,
      workspaceId: input.workspaceId,
      active: true,
    },
  });
  if (!caller) throw new Error("Authorized caller not found");

  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const ttl = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);

  const row = await prisma.smartRoutingEmployeeAccessToken.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      authorizedCallerId: input.authorizedCallerId,
      tokenHash,
      label: input.label?.trim() || null,
      expiresAt,
    },
  });

  return { token: rawToken, id: row.id, expiresAt };
}

export async function validateEmployeeAccessToken(rawToken: string) {
  const prisma = getPrisma();
  const tokenHash = hashToken(rawToken.trim());
  const row = await prisma.smartRoutingEmployeeAccessToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      authorizedCaller: true,
      workspace: { select: { id: true, name: true } },
    },
  });
  if (!row || !row.authorizedCaller?.active) return null;

  await prisma.smartRoutingEmployeeAccessToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
  });

  return row;
}

export async function revokeEmployeeAccessToken(workspaceId: string, tokenId: string) {
  const prisma = getPrisma();
  await prisma.smartRoutingEmployeeAccessToken.updateMany({
    where: { id: tokenId, workspaceId },
    data: { revokedAt: new Date() },
  });
}

export async function listEmployeeAccessTokens(workspaceId: string, authorizedCallerId?: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingEmployeeAccessToken.findMany({
    where: {
      workspaceId,
      ...(authorizedCallerId ? { authorizedCallerId } : {}),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: { authorizedCaller: { select: { name: true } } },
  });
}
