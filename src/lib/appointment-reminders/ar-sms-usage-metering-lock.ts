/**
 * Serializes AR SMS metering per workspace in this Node process.
 * Supabase PostgREST has no real transactions; cross-process races are bounded
 * by re-reading usage before increment (see reserve implementation).
 */
const tails = new Map<string, Promise<void>>();

export async function withArSmsMeteringLock<T>(
  workspaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = tails.get(workspaceId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(workspaceId, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(workspaceId) === gate) {
      tails.delete(workspaceId);
    }
  }
}
