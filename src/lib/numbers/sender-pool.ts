import { getPrisma } from "@/lib/db";

export type PickedSender = {
  phoneNumberId: string;
  e164: string;
};

/**
 * Round-robin selection of a phone number from a sender pool.
 *
 * The pool has no dedicated cursor column, so we rotate the persisted
 * `phoneNumberIds` array on each pick: the chosen number is moved to the end
 * of the list and the reordered array is saved (touching `updatedAt`). This
 * yields a stable round-robin using only existing fields.
 */
export async function pickNextFromPool(
  workspaceId: string,
  poolId: string,
): Promise<PickedSender | null> {
  const prisma = getPrisma();
  const pool = await prisma.senderPool.findFirst({
    where: { id: poolId, workspaceId, status: "Active" },
  });
  if (!pool || !Array.isArray(pool.phoneNumberIds) || pool.phoneNumberIds.length === 0) {
    return null;
  }

  const numbers = await prisma.phoneNumber.findMany({
    where: {
      workspaceId,
      id: { in: pool.phoneNumberIds },
      status: "Active",
    },
  });
  if (numbers.length === 0) return null;

  const byId = new Map<string, string>(
    (numbers as Array<{ id: string; e164: string }>).map((n) => [n.id, n.e164]),
  );

  // Preserve stored ordering, dropping ids that are no longer valid.
  const orderedValidIds = (pool.phoneNumberIds as string[]).filter((id: string) => byId.has(id));
  if (orderedValidIds.length === 0) return null;

  const chosenId = orderedValidIds[0];
  const chosenE164 = byId.get(chosenId)!;

  // Rotate: move chosen id to the end so the next pick advances.
  const rotated = [...orderedValidIds.slice(1), chosenId];

  // Keep any not-yet-resolved ids (e.g. released numbers) at the tail so the
  // stored array is self-healing without silently dropping user config.
  const staleIds = (pool.phoneNumberIds as string[]).filter((id: string) => !byId.has(id));
  const nextOrder = [...rotated, ...staleIds];

  try {
    await prisma.senderPool.update({
      where: { id: pool.id },
      data: { phoneNumberIds: nextOrder },
    });
  } catch (err) {
    // Rotation is best-effort; a failed write just means the next pick may
    // reuse the same number. Never block a send on it.
    console.warn("[sender-pool] rotate failed", poolId, err);
  }

  return { phoneNumberId: chosenId, e164: chosenE164 };
}

/**
 * Resolve the sending number for a workspace, preferring a sender pool when set.
 * Returns undefined when no pool number could be resolved (caller falls back to
 * the registration default number).
 */
export async function resolvePoolSender(
  workspaceId: string,
  senderPoolId: string | null | undefined,
): Promise<string | undefined> {
  if (!senderPoolId) return undefined;
  const picked = await pickNextFromPool(workspaceId, senderPoolId);
  return picked?.e164;
}
