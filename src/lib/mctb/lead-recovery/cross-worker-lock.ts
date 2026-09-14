/**
 * Cross-worker conversation serialization.
 * Production: Postgres advisory xact lock when available.
 * E2E in-memory state: same-process chain lock (multi-instance simulated via CAS tests).
 */
import { getPrisma } from "@/lib/db";
import { withLeadRecoveryConversationLock } from "@/lib/mctb/lead-recovery/conversation-guard";

function conversationLockKey(conversationId: string): bigint {
  let hash = 0;
  for (let i = 0; i < conversationId.length; i++) {
    hash = (hash * 31 + conversationId.charCodeAt(i)) | 0;
  }
  return BigInt(Math.abs(hash));
}

function canUsePostgresAdvisoryLock(): boolean {
  if (process.env.LR_CERT_E2E === "1") return false;
  const prisma = getPrisma() as {
    $executeRaw?: unknown;
    $transaction?: unknown;
  };
  return Boolean(prisma.$executeRaw && prisma.$transaction);
}

export async function withLeadRecoveryCrossWorkerLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!canUsePostgresAdvisoryLock()) {
    return withLeadRecoveryConversationLock(conversationId, fn);
  }

  const prisma = getPrisma();
  const key = conversationLockKey(conversationId);
  return prisma.$transaction(async (tx) => {
    await (tx as typeof prisma).$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
    return fn();
  });
}
