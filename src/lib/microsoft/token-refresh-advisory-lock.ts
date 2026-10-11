import "server-only";

import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { withMicrosoftTokenRefreshLock as withInProcessLock } from "@/lib/microsoft/token-refresh-lock";

/** Advisory namespace for Microsoft calendar OAuth refresh (per connection). */
const LOCK_NAMESPACE = 0x4d534341; // "MSCA"

function lockKeys(connectionId: string): [number, number] {
  const digest = createHash("sha256").update(connectionId).digest();
  return [LOCK_NAMESPACE, digest.readInt32BE(0) ^ digest.readInt32BE(4)];
}

async function tryPgAdvisoryLock(connectionId: string): Promise<boolean> {
  const prisma = getPrisma();
  const [k1, k2] = lockKeys(connectionId);
  try {
    await prisma.$executeRaw`SELECT pg_advisory_lock(${k1}, ${k2})`;
    return true;
  } catch {
    return false;
  }
}

async function pgAdvisoryUnlock(connectionId: string): Promise<void> {
  const prisma = getPrisma();
  const [k1, k2] = lockKeys(connectionId);
  try {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${k1}, ${k2})`;
  } catch {
    // pool may not hold session lock
  }
}

/**
 * Cross-process refresh mutex when Postgres advisory locks are available;
 * always includes in-process coalescing for the same Node instance.
 */
export async function withMicrosoftCalendarTokenRefreshLock<T>(
  connectionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withInProcessLock(connectionId, async () => {
    const locked = await tryPgAdvisoryLock(connectionId);
    try {
      return await fn();
    } finally {
      if (locked) await pgAdvisoryUnlock(connectionId);
    }
  });
}
