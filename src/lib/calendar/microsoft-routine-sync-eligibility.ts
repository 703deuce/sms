import type { CalendarConfig } from "@/lib/calendar/providers";

export type MicrosoftConnectionScheduleRow = {
  id: string;
  status: string;
  credentialsRef: string | null;
  config: unknown;
};

/** True when OAuth material exists to attempt Graph (reauth may still fail at runtime). */
export function microsoftConnectionHasStoredCredentials(
  config: CalendarConfig,
  credentialsRef: string | null | undefined,
): boolean {
  if (credentialsRef?.trim()) return true;
  const refresh = config.refreshToken?.trim();
  if (refresh) return true;
  const access = config.accessToken?.trim();
  if (access && config.expiresAt && config.expiresAt > Date.now() - 60_000) return true;
  return false;
}

/**
 * Routine reconcile/backstop sync — not webhooks or explicit user "Sync now".
 * needs_reauth without stored credentials must not enqueue endless recovery work.
 */
export function isEligibleForRoutineMicrosoftCalendarSync(conn: MicrosoftConnectionScheduleRow): {
  eligible: boolean;
  reason?: "needs_reauth_no_credentials" | "disconnected" | "unsupported_status";
} {
  if (conn.status === "disconnected") {
    return { eligible: false, reason: "disconnected" };
  }
  if (conn.status !== "connected" && conn.status !== "needs_reauth") {
    return { eligible: false, reason: "unsupported_status" };
  }
  const config = (conn.config || {}) as CalendarConfig;
  if (!microsoftConnectionHasStoredCredentials(config, conn.credentialsRef)) {
    return { eligible: false, reason: "needs_reauth_no_credentials" };
  }
  return { eligible: true };
}

export function routineMicrosoftCalendarSyncIdempotencyKey(connectionId: string, incremental = true) {
  return `calendar-sync-routine-${connectionId}-${incremental ? "inc" : "full"}`;
}
