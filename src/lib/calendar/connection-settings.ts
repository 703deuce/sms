import "server-only";

import {
  deleteWorkspaceCalendarConnection,
  getWorkspaceCalendarConnection,
  updateWorkspaceCalendarConnection,
} from "@/lib/calendar/connections";
import {
  getGoogleCalendars,
  getValidAccessToken,
  listMicrosoftCalendarsForConnection,
  type CalendarConfig,
} from "@/lib/calendar/providers";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import { registerCalendarPushNotifications, ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";

export async function listConnectionProviderCalendars(workspaceId: string, connectionId: string) {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn || !["google", "microsoft"].includes(conn.provider)) {
    throw new Error("Calendar connection not found");
  }

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, conn.provider, config);
  if (!token) {
    await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
      status: "needs_reauth",
    });
    throw new Error("Reconnect required");
  }

  const calendars =
    conn.provider === "google"
      ? await getGoogleCalendars(token)
      : await listMicrosoftCalendarsForConnection(conn.id, config);

  return calendars;
}

export type CalendarConnectionVerification = {
  ok: boolean;
  provider: string;
  tokenValid: boolean;
  calendarCount: number;
  syncEnabled: boolean;
  importConfigured: boolean;
  push: {
    status: "not_configured" | "active" | "missing" | "failed";
    expiresAt?: string | null;
    error?: string;
  };
  errors: string[];
  verifiedAt: string;
};

/** Live provider check: token, calendar list, and Microsoft push subscription when sync is on. */
export async function verifyWorkspaceCalendarConnection(
  workspaceId: string,
  connectionId: string,
): Promise<CalendarConnectionVerification> {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn || !["google", "microsoft"].includes(conn.provider)) {
    throw new Error("Calendar connection not found");
  }

  const config = { ...(conn.config || {}) } as CalendarConfig;
  const errors: string[] = [];
  let tokenValid = false;
  let calendarCount = 0;
  let pushStatus: CalendarConnectionVerification["push"]["status"] = "not_configured";
  let pushExpiresAt: string | null = null;
  let pushError: string | undefined;

  const token = await getValidAccessToken(conn.id, conn.provider, config);
  if (!token) {
    errors.push("Access token unavailable — reconnect required");
    await updateWorkspaceCalendarConnection(workspaceId, connectionId, { status: "needs_reauth" });
  } else {
    tokenValid = true;
    try {
      const calendars =
        conn.provider === "google"
          ? await getGoogleCalendars(token)
          : await listMicrosoftCalendarsForConnection(conn.id, config);
      calendarCount = calendars.length;
      if (!calendarCount) errors.push("Provider returned no calendars");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not list provider calendars";
      errors.push(msg);
      if (/\b401\b/.test(msg)) {
        tokenValid = false;
        await updateWorkspaceCalendarConnection(workspaceId, connectionId, { status: "needs_reauth" });
      }
    }
  }

  const importConfigured = Boolean(config.importCalendarIds?.length);
  const syncEnabled = config.syncEnabled === true;

  if (conn.provider === "microsoft" && syncEnabled && importConfigured && tokenValid) {
    try {
      const sub = await ensureMicrosoftCalendarSubscription(workspaceId, connectionId);
      if (sub?.expiresAt) {
        pushStatus = "active";
        pushExpiresAt = sub.expiresAt;
      } else {
        pushStatus = "failed";
        pushError = "Microsoft change notifications could not be registered";
        errors.push(pushError);
      }
    } catch (err) {
      pushStatus = "failed";
      pushError = err instanceof Error ? err.message : "Push registration failed";
      errors.push(pushError);
    }
  } else if (conn.provider === "microsoft" && importConfigured && !syncEnabled) {
    pushStatus = "not_configured";
  }

  const verifiedAt = new Date().toISOString();
  const ok = tokenValid && calendarCount > 0 && errors.length === 0;

  await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    ...(ok && conn.status === "needs_reauth" ? { status: "connected" } : {}),
    ...(!ok && errors.some((e) => /\b401\b/.test(e)) ? { status: "needs_reauth" } : {}),
    config: {
      ...config,
      lastVerifiedAt: verifiedAt,
      lastVerificationOk: ok,
      lastVerificationError: errors[0] || null,
    },
  });

  return {
    ok,
    provider: conn.provider,
    tokenValid,
    calendarCount,
    syncEnabled,
    importConfigured,
    push: {
      status: pushStatus,
      expiresAt: pushExpiresAt,
      error: pushError,
    },
    errors,
    verifiedAt,
  };
}

export async function patchWorkspaceCalendarConnection(
  workspaceId: string,
  connectionId: string,
  input: {
    name?: string;
    writeCalendarId?: string;
    blockingCalendarIds?: string[];
    importCalendarIds?: string[];
    syncEnabled?: boolean;
    timezone?: string;
    importRules?: CalendarConfig["importRules"];
  },
) {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn) return null;

  const config = { ...(conn.config || {}) } as CalendarConfig;
  if (input.writeCalendarId !== undefined) config.writeCalendarId = input.writeCalendarId;
  if (input.blockingCalendarIds !== undefined) config.blockingCalendarIds = input.blockingCalendarIds;
  if (input.importCalendarIds !== undefined) config.importCalendarIds = input.importCalendarIds;
  if (input.syncEnabled !== undefined) config.syncEnabled = input.syncEnabled;
  if (input.timezone !== undefined) config.timezone = input.timezone;
  if (input.importRules !== undefined) config.importRules = input.importRules;

  const row = await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    config: config as Record<string, unknown>,
  });

  if (
    row &&
    (input.importCalendarIds !== undefined ||
      input.syncEnabled !== undefined ||
      input.importRules !== undefined ||
      input.writeCalendarId !== undefined ||
      input.blockingCalendarIds !== undefined)
  ) {
    await registerCalendarPushNotifications(workspaceId, connectionId).catch(() => undefined);
    if (conn.provider === "microsoft") {
      await verifyWorkspaceCalendarConnection(workspaceId, connectionId).catch((err) => {
        console.warn("[calendar] verify after patch failed", connectionId, err);
      });
    }
  }

  return row;
}

export async function disconnectWorkspaceCalendarConnection(workspaceId: string, connectionId: string) {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn) return false;
  await deleteWorkspaceCalendarConnection(workspaceId, connectionId);
  return true;
}
