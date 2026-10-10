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
  refreshMicrosoftMailboxTimezone,
  type CalendarConfig,
} from "@/lib/calendar/providers";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import { registerCalendarPushNotifications, ensureMicrosoftCalendarSubscription, deleteMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";

export async function listConnectionProviderCalendars(workspaceId: string, connectionId: string) {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn || !["google", "microsoft"].includes(conn.provider)) {
    throw new Error("Calendar connection not found");
  }

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, conn.provider, config);
  if (!token) {
    const refreshKind = config.lastTokenRefreshKind;
    const transient =
      refreshKind === "transient" ||
      refreshKind === "misconfigured" ||
      refreshKind === "unknown";
    if (!transient) {
      await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
        status: "needs_reauth",
      });
    }
    throw new Error(transient ? "Microsoft token refresh failed temporarily" : "Reconnect required");
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
  accountType?: "personal" | "organizational" | "unknown";
  mailboxTimezone?: string | null;
  push: {
    status: "not_configured" | "active" | "missing" | "failed" | "degraded";
    expiresAt?: string | null;
    error?: string;
  };
  health: "healthy" | "needs_reconnect" | "token_refresh_failed" | "webhook_degraded" | "sync_failed" | "permission_missing";
  errors: string[];
  graphDiagnostics?: {
    httpStatus?: number;
    graphCode?: string;
    graphMessage?: string;
    requestId?: string;
  };
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
    const refreshKind = config.lastTokenRefreshKind;
    const transient =
      refreshKind === "transient" ||
      refreshKind === "misconfigured" ||
      refreshKind === "unknown";
    errors.push(
      transient
        ? "Access token refresh failed temporarily — will retry automatically"
        : "Access token unavailable — reconnect required",
    );
    if (!transient) {
      await updateWorkspaceCalendarConnection(workspaceId, connectionId, { status: "needs_reauth" });
    }
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

    if (conn.provider === "microsoft" && tokenValid) {
      try {
        const mailboxTimezone = await refreshMicrosoftMailboxTimezone(conn.id, config);
        if (mailboxTimezone) {
          config.mailboxTimezone = mailboxTimezone;
        }
      } catch {
        // non-fatal
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

  let health: CalendarConnectionVerification["health"] = "healthy";
  if (!tokenValid) {
    const refreshKind = config.lastTokenRefreshKind;
    if (errors.some((e) => /permission|scope|403/i.test(e))) {
      health = "permission_missing";
    } else if (
      refreshKind === "transient" ||
      refreshKind === "misconfigured" ||
      refreshKind === "unknown"
    ) {
      health = "token_refresh_failed";
    } else {
      health = "needs_reconnect";
    }
  } else if (pushStatus === "failed") {
    health = "webhook_degraded";
  } else if (!ok && config.lastSyncError) {
    health = "sync_failed";
  }

  await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    ...(ok && conn.status === "needs_reauth" ? { status: "connected" } : {}),
    ...(!ok && (health === "needs_reconnect" || health === "permission_missing")
      ? { status: "needs_reauth" }
      : {}),
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
    accountType: config.accountType,
    mailboxTimezone: config.mailboxTimezone || null,
    push: {
      status: pushStatus,
      expiresAt: pushExpiresAt,
      error: pushError,
    },
    health,
    errors,
    graphDiagnostics: config.lastGraphError
      ? {
          httpStatus: config.lastGraphError.httpStatus,
          graphCode: config.lastGraphError.graphCode,
          graphMessage: config.lastGraphError.graphMessage,
          requestId: config.lastGraphError.requestId,
        }
      : undefined,
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
    reminderDefaults?: {
      smsEnabled?: boolean;
      emailEnabled?: boolean;
      voiceEnabled?: boolean;
      replyDestinationPhone?: string;
      replyDestinationEmail?: string;
      attachIcs?: boolean;
    };
  },
) {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn) return null;

  if (input.importCalendarIds !== undefined) {
    const { workspaceHasAppointmentReminders } = await import(
      "@/lib/appointment-reminders/entitlement"
    );
    if (await workspaceHasAppointmentReminders(workspaceId)) {
      const { assertWorkspaceImportCalendarPatchAllowed } = await import(
        "@/lib/appointment-reminders/commercial/ar-calendar-limits"
      );
      await assertWorkspaceImportCalendarPatchAllowed(
        workspaceId,
        connectionId,
        input.importCalendarIds,
      );
    }
  }

  const config = { ...(conn.config || {}) } as CalendarConfig;
  if (input.writeCalendarId !== undefined) config.writeCalendarId = input.writeCalendarId;
  if (input.blockingCalendarIds !== undefined) config.blockingCalendarIds = input.blockingCalendarIds;
  if (input.importCalendarIds !== undefined) config.importCalendarIds = input.importCalendarIds;
  if (input.syncEnabled !== undefined) config.syncEnabled = input.syncEnabled;
  if (input.timezone !== undefined) config.timezone = input.timezone;
  if (input.importRules !== undefined) config.importRules = input.importRules;
  if (input.reminderDefaults !== undefined) {
    (config as CalendarConfig & { reminderDefaults?: unknown }).reminderDefaults =
      input.reminderDefaults;
  }

  const row = await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    config: config as Record<string, unknown>,
  });

  const prevConfig = (conn.config || {}) as CalendarConfig;
  const hadImport = Boolean(prevConfig.importCalendarIds?.length);
  const hasImport = Boolean(config.importCalendarIds?.length);
  const syncEnabled = config.syncEnabled !== false;
  const importNewlyEnabled =
    syncEnabled &&
    hasImport &&
    (input.importCalendarIds !== undefined ||
      input.syncEnabled === true ||
      (!hadImport && hasImport));

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

  const importSelectionSaved =
    row &&
    input.importCalendarIds !== undefined &&
    hasImport &&
    syncEnabled &&
    JSON.stringify(prevConfig.importCalendarIds ?? []) !==
      JSON.stringify(config.importCalendarIds ?? []);

  if (row && (importNewlyEnabled || importSelectionSaved)) {
    const { enqueueCalendarConnectionSync, syncWorkspaceCalendarConnection } = await import(
      "@/lib/calendar/import-sync",
    );
    await enqueueCalendarConnectionSync(workspaceId, connectionId, false, {
      priority: 20,
      wake: true,
    }).catch((err) => {
      console.warn("[calendar] auto-sync enqueue after import enable failed", connectionId, err);
    });

    const { workspaceHasAppointmentReminders } = await import(
      "@/lib/appointment-reminders/entitlement",
    );
    const isAr = await workspaceHasAppointmentReminders(workspaceId);
    const needsInitialImport = isAr && !conn.lastSyncAt;
    if (needsInitialImport || (isAr && importSelectionSaved)) {
      await syncWorkspaceCalendarConnection(workspaceId, connectionId, {
        incremental: Boolean(conn.lastSyncAt),
        manual: false,
      }).catch((err) => {
        console.warn("[calendar] inline AR sync after import save failed", connectionId, err);
      });
    }
  }

  return row;
}

export async function disconnectWorkspaceCalendarConnection(workspaceId: string, connectionId: string) {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn) return false;

  if (conn.provider === "microsoft") {
    await deleteMicrosoftCalendarSubscription(workspaceId, connectionId).catch(() => undefined);
  }

  await deleteWorkspaceCalendarConnection(workspaceId, connectionId);
  return true;
}
