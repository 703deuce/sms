import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getPrisma } from "@/lib/server/db";
import type { PowerDialerApiScope } from "./scopes";

const KEY_PREFIX = "pd_live_";

function hashKey(raw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(raw, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyKey(raw: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = scryptSync(raw, salt, 32);
  const actual = Buffer.from(hashHex, "hex");
  try {
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function createPowerDialerApiKey(input: {
  workspaceId: string;
  name: string;
  scopes: PowerDialerApiScope[];
  rateLimitPerMinute?: number;
  createdByUserId?: string;
}) {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 16);
  const prisma = getPrisma();
  const row = await prisma.powerDialerApiKey.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim() || "API key",
      prefix,
      hashedKey: hashKey(raw),
      scopes: input.scopes,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 120,
      createdByUserId: input.createdByUserId,
    },
  });
  return { row, secret: raw };
}

export async function revokePowerDialerApiKey(workspaceId: string, id: string) {
  const prisma = getPrisma();
  await prisma.powerDialerApiKey.updateMany({
    where: { id, workspaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotatePowerDialerApiKey(workspaceId: string, id: string) {
  const prisma = getPrisma();
  const row = await prisma.powerDialerApiKey.findFirst({
    where: { id, workspaceId, revokedAt: null },
  });
  if (!row) throw new Error("API key not found");
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 16);
  await prisma.powerDialerApiKey.update({
    where: { id },
    data: { prefix, hashedKey: hashKey(raw), lastUsedAt: null },
  });
  return { row, secret: raw };
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(keyId: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(keyId);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(keyId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= limitPerMinute) return false;
  bucket.count += 1;
  return true;
}

export type ApiKeyAuth = {
  workspaceId: string;
  apiKeyId: string;
  scopes: string[];
};

export async function authenticatePowerDialerApiKey(
  authorizationHeader: string | null,
): Promise<ApiKeyAuth | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const raw = authorizationHeader.slice(7).trim();
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const prefix = raw.slice(0, 16);
  const prisma = getPrisma();
  const candidates = await prisma.powerDialerApiKey.findMany({
    where: { prefix, revokedAt: null },
    take: 5,
  });
  for (const row of candidates) {
    if (!verifyKey(raw, row.hashedKey)) continue;
    if (!checkRateLimit(row.id, row.rateLimitPerMinute)) {
      throw new Error("Rate limit exceeded");
    }
    await prisma.powerDialerApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    return { workspaceId: row.workspaceId, apiKeyId: row.id, scopes: row.scopes };
  }
  return null;
}

export async function logApiAudit(input: {
  workspaceId: string;
  apiKeyId?: string;
  actorUserId?: string;
  impersonatedUserId?: string;
  action: string;
  resource?: string;
  detail?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  await prisma.powerDialerApiAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      apiKeyId: input.apiKeyId,
      actorUserId: input.actorUserId,
      impersonatedUserId: input.impersonatedUserId,
      action: input.action,
      resource: input.resource,
      detailJson: input.detail ?? {},
    },
  });
}

export function idempotencyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}
