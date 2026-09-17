import "server-only";

/** Prevent concurrent refresh storms from rotating refresh tokens out from under each other. */
const inflight = new Map<string, Promise<unknown>>();

export async function withMicrosoftTokenRefreshLock<T>(
  connectionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(connectionId) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => {
    inflight.delete(connectionId);
  });
  inflight.set(connectionId, promise);
  return promise;
}
