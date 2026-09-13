/**
 * Per-workspace/provider mutex for OAuth refresh (Calendly rotating refresh tokens).
 * Rule CAL-AUTH-003 — concurrent workers must not reuse a consumed refresh token.
 */

const inflight = new Map<string, Promise<string>>();

export async function withIntegrationTokenRefreshLock<T>(
  workspaceId: string,
  provider: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `${workspaceId}:${provider}`;
  const existing = inflight.get(key);
  if (existing) {
    await existing.catch(() => undefined);
    return fn();
  }
  const run = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(
    key,
    run.then(() => "").catch(() => ""),
  );
  return run;
}
