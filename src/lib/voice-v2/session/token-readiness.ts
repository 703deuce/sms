import "server-only";

import { getValidAccessToken, hasOAuthTokens, type CalendarConfig } from "@/lib/voice/calendar/providers";
import { getPrisma } from "@/lib/db";

const REFRESH_SKEW_MS = 120_000;

export type TokenWarmupResult = {
  connectionId: string;
  refreshed: boolean;
  skippedReason?: "valid" | "not_near_expiry" | "aborted" | "no_connection";
};

const inFlightByConnection = new Map<string, Promise<TokenWarmupResult>>();

function tokenLockKey(connectionId: string): string {
  return `voice:v2:token-refresh:${connectionId}`;
}

/** P3 — distributed single-flight token refresh at warmup (non-blocking for greeting). */
export async function warmMicrosoftTokenIfNeeded(input: {
  workspaceId: string;
  connectionId: string | null;
  bookingEnabled: boolean;
  signal?: AbortSignal;
}): Promise<TokenWarmupResult> {
  if (!input.bookingEnabled || !input.connectionId) {
    return { connectionId: input.connectionId || "", refreshed: false, skippedReason: "no_connection" };
  }
  if (input.signal?.aborted) {
    return { connectionId: input.connectionId, refreshed: false, skippedReason: "aborted" };
  }

  const existing = inFlightByConnection.get(input.connectionId);
  if (existing) return existing;

  const work = (async (): Promise<TokenWarmupResult> => {
    const prisma = getPrisma();
    const conn = await prisma.voiceCalendarConnection.findFirst({
      where: { id: input.connectionId!, workspaceId: input.workspaceId, provider: "microsoft" },
    });
    if (!conn || conn.status !== "connected") {
      return { connectionId: input.connectionId!, refreshed: false, skippedReason: "no_connection" };
    }
    const config = (conn.config || {}) as CalendarConfig;
    if (!hasOAuthTokens(config)) {
      return { connectionId: input.connectionId!, refreshed: false, skippedReason: "no_connection" };
    }
    const expiresAt = Number(config.expiresAt || 0);
    const nearExpiry = !expiresAt || expiresAt <= Date.now() + REFRESH_SKEW_MS;
    if (!nearExpiry) {
      return { connectionId: input.connectionId!, refreshed: false, skippedReason: "valid" };
    }

    const { getRealtimeSessionStore } = await import("@/lib/voice/realtime-session/store");
    const store = getRealtimeSessionStore();
    let release: (() => Promise<void>) | null = null;
    try {
      release = await store.acquireLock(tokenLockKey(input.connectionId!), 8000);
    } catch {
      // proceed without lock in dev-only memory mode
    }
    try {
      if (input.signal?.aborted) {
        return { connectionId: input.connectionId!, refreshed: false, skippedReason: "aborted" };
      }
      const token = await getValidAccessToken(conn.id, "microsoft", config);
      return {
        connectionId: input.connectionId!,
        refreshed: Boolean(token),
        skippedReason: token ? undefined : "no_connection",
      };
    } finally {
      if (release) await release().catch(() => undefined);
    }
  })();

  inFlightByConnection.set(input.connectionId, work);
  try {
    return await work;
  } finally {
    inFlightByConnection.delete(input.connectionId);
  }
}

/** Test helper */
export function clearTokenWarmupInFlightForTests(): void {
  inFlightByConnection.clear();
}
