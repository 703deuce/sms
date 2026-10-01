import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const LOCK_NAMESPACE = 0x4d435442; // "MCTB"

function hashWorkspaceId(workspaceId: string): number {
  let h = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    h = (Math.imul(31, h) + workspaceId.charCodeAt(i)) | 0;
  }
  return h;
}

function lockKeys(workspaceId: string): [number, number] {
  return [LOCK_NAMESPACE, hashWorkspaceId(workspaceId)];
}

async function pgAdvisoryLock(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const [k1, k2] = lockKeys(workspaceId);
  try {
    await prisma.$executeRaw`SELECT pg_advisory_lock(${k1}, ${k2})`;
    return true;
  } catch {
    return false;
  }
}

async function pgAdvisoryUnlock(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const [k1, k2] = lockKeys(workspaceId);
  try {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${k1}, ${k2})`;
  } catch {
    // ignore — session may not hold lock (compat / pool)
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Persist purchased E.164 when Telnyx buy succeeded but local import is incomplete. */
export async function readMctbIngressProvisionPendingE164(
  workspaceId: string,
  tx?: Prisma.TransactionClient,
): Promise<string | null> {
  const prisma = tx ?? getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const pending = asRecord(limits.mctbIngressProvisionPending);
  const e164 = pending.e164;
  return typeof e164 === "string" && e164.trim() ? e164.trim() : null;
}

export async function writeMctbIngressProvisionPendingE164(
  workspaceId: string,
  e164: string,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const next = {
    ...limits,
    mctbIngressProvisionPending: { e164, recordedAt: new Date().toISOString() },
  };
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: { workspaceId, limits: next },
    update: { limits: next },
  });
}

export async function clearMctbIngressProvisionPendingE164(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  if (!row) return;
  const limits = asRecord(row.limits);
  if (!limits.mctbIngressProvisionPending) return;
  const { mctbIngressProvisionPending: _drop, ...rest } = limits;
  await prisma.workspaceLimits.update({
    where: { workspaceId },
    data: { limits: rest },
  });
}

const inProcessIngressLockTails = new Map<string, Promise<unknown>>();

async function withInProcessIngressProvisionLock<T>(
  workspaceId: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = inProcessIngressLockTails.get(workspaceId) ?? Promise.resolve();
  const run = previous.then(() => work());
  inProcessIngressLockTails.set(
    workspaceId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/**
 * One workspace → at most one concurrent Telnyx ingress purchase/provision flow.
 * Prefers Postgres advisory locks; falls back to an in-process mutex when advisory SQL is unavailable
 * (compat/test). Callers must re-check idempotent state inside the critical section.
 */
export async function withMctbWorkspaceIngressProvisionLock<T>(
  workspaceId: string,
  work: () => Promise<T>,
): Promise<T> {
  const acquired = await pgAdvisoryLock(workspaceId);
  if (acquired) {
    try {
      return await work();
    } finally {
      await pgAdvisoryUnlock(workspaceId);
    }
  }
  return withInProcessIngressProvisionLock(workspaceId, work);
}
