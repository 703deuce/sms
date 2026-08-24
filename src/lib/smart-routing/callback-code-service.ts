import "server-only";

import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

const SALT_ROUNDS = 10;
const DEFAULT_TTL_MINUTES = 60;

function randomNumericCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += String(Math.floor(Math.random() * 10));
  }
  return code;
}

export async function createTemporaryCallbackCode(input: {
  workspaceId: string;
  authorizedCallerId: string;
  ttlMinutes?: number;
  label?: string | null;
}) {
  const prisma = getPrisma();
  const code = randomNumericCode(6);
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const ttl = input.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  const row = await prisma.smartRoutingCallbackCode.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      authorizedCallerId: input.authorizedCallerId,
      codeHash,
      label: input.label?.trim() || null,
      expiresAt,
    },
  });

  return { id: row.id, code, expiresAt };
}

export async function verifyTemporaryCallbackCode(input: {
  workspaceId: string;
  authorizedCallerId: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const prisma = getPrisma();
  const digits = String(input.code || "").replace(/\D/g, "");
  if (digits.length < 4) return { ok: false, reason: "invalid" };

  const rows = await prisma.smartRoutingCallbackCode.findMany({
    where: {
      workspaceId: input.workspaceId,
      authorizedCallerId: input.authorizedCallerId,
      revokedAt: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  for (const row of rows) {
    const match = await bcrypt.compare(digits, row.codeHash);
    if (!match) continue;
    await prisma.smartRoutingCallbackCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { ok: true };
  }

  return { ok: false, reason: "not_found" };
}

export async function revokeCallbackCodesForCaller(
  workspaceId: string,
  authorizedCallerId: string,
) {
  await getPrisma().smartRoutingCallbackCode.updateMany({
    where: { workspaceId, authorizedCallerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
