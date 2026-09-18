import { getPrisma } from "@/lib/db";
import type { CalendarImportRules } from "@/lib/calendar/eligibility";
import {
  refreshMicrosoftAccessToken,
  extractMicrosoftTenantIdFromToken,
  extractMicrosoftUserIdFromToken,
} from "@/lib/microsoft/oauth-config";
import { withMicrosoftTokenRefreshLock } from "@/lib/microsoft/token-refresh-lock";
import type { MicrosoftTokenRefreshResult } from "@/lib/microsoft/token-errors";
import {
  GRAPH_PREFER_OUTLOOK_UTC,
  MICROSOFT_GRAPH_V1,
  canUseMicrosoftGetSchedule,
  inferMicrosoftAccountType,
  isMicrosoftBusyScheduleStatus,
  isMicrosoftBusyShowAs,
  microsoftCalendarViewUrl,
  parseMicrosoftEventDateTime,
  parseMicrosoftGraphDateTime,
  parseMicrosoftGraphError,
  resolveMicrosoftAccountType,
  toMicrosoftDateTimeTimeZone,
  type MicrosoftAccountType,
  type MicrosoftGraphCollectionPage,
  type MicrosoftGraphError,
} from "@/lib/microsoft/graph-helpers";
import {
  addCalendarDays,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "@/lib/voice/calendar/timezone-slots";

export type CalendarConfig = {
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  /** Google calendar id or Microsoft calendar id for reads/writes */
  calendarId?: string;
  /** Google calendar ids used for availability blocking */
  blockingCalendarIds?: string[];
  /** Google/Microsoft calendar ids to import events from */
  importCalendarIds?: string[];
  /** Google/Microsoft calendar id that receives Transovo-created events */
  writeCalendarId?: string;
  syncEnabled?: boolean;
  syncLookbackDays?: number;
  syncLookaheadDays?: number;
  lastSyncError?: string | null;
  importRules?: CalendarImportRules;
  reminderDefaults?: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    voiceEnabled?: boolean;
    replyDestinationPhone?: string;
    replyDestinationEmail?: string;
    attachIcs?: boolean;
  };
  /** Microsoft Graph subscription id + expiry */
  microsoftSubscription?: { id: string; expiresAt: string; resource?: string };
  /** Google Calendar watch channel */
  googleWatchChannels?: Array<{ calendarId: string; channelId: string; resourceId: string; expiresAt: string }>;
  timezone?: string;
  /** Outlook mailbox timezone from GET /me/mailboxSettings (provider metadata). */
  mailboxTimezone?: string;
  webhookUrl?: string;
  email?: string;
  displayName?: string;
  /** Microsoft object id from Graph /me or token claims. */
  microsoftUserId?: string;
  /** Microsoft Entra tenant id; personal accounts use the MSA tenant. */
  tenantId?: string;
  /** personal = Outlook.com/Hotmail; organizational = work/school; unknown = not yet determined. */
  accountType?: MicrosoftAccountType;
  /** Per-calendar delta sync state for Microsoft import calendars. */
  microsoftDeltaLinks?: Record<
    string,
    {
      deltaLink: string;
      windowStart: string;
      windowEnd: string;
      updatedAt: string;
    }
  >;
  /** Sanitized last Graph error for support diagnostics. */
  lastGraphError?: MicrosoftGraphError | null;
  lastVerifiedAt?: string;
  lastVerificationOk?: boolean;
  lastVerificationError?: string | null;
  /** Space-delimited scopes returned by Microsoft token endpoint. */
  grantedScopes?: string;
  /** Sanitized Microsoft token refresh diagnostics (no secrets). */
  lastTokenRefreshAt?: string;
  lastTokenRefreshKind?: string;
  lastTokenRefreshError?: string | null;
  /** Provenance for refresh diagnostics (production_web, certification, etc.). */
  lastTokenRefreshSource?: string;
  lastTokenRefreshBuildSha?: string | null;
};

export type BusyInterval = { start: Date; end: Date };

export type ProviderCalendar = {
  id: string;
  name: string;
  primary?: boolean;
  canEdit?: boolean;
  owner?: string;
};

export type MicrosoftGraphContext = {
  connectionId: string;
  config: CalendarConfig;
};

/** Whether a connection has usable OAuth tokens for live calendar access. */
export function hasOAuthTokens(config: CalendarConfig | null | undefined) {
  return Boolean(config?.accessToken || config?.refreshToken);
}

export function resolveWriteCalendarId(config: CalendarConfig) {
  return config.writeCalendarId || config.calendarId || "primary";
}

/** Outlook mailbox timezone for interpreting Microsoft-owned event timestamps. */
export function resolveMicrosoftProviderTimezone(config: CalendarConfig): string {
  return config.mailboxTimezone || config.timezone || "UTC";
}

export function resolveBlockingCalendarIds(config: CalendarConfig, provider: string) {
  if (config.blockingCalendarIds?.length) return config.blockingCalendarIds;
  if (provider === "google") return [config.calendarId || "primary"];
  return [];
}

/**
 * Return a valid access token, refreshing via the stored refresh token when the
 * current one is missing/expired, and persisting the new token on the row.
 */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60_000;

async function markCalendarConnectionNeedsReauth(connectionId: string) {
  await getPrisma()
    .voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { status: "needs_reauth" },
    })
    .catch(() => undefined);
}

async function markCalendarConnectionConnected(connectionId: string) {
  await getPrisma()
    .voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { status: "connected" },
    })
    .catch(() => undefined);
}

async function persistTokenRefreshDiagnostics(
  connectionId: string,
  config: CalendarConfig,
  input: {
    ok: boolean;
    kind?: string;
    error?: string | null;
    scope?: string;
    source?: string;
    buildSha?: string | null;
  },
) {
  const { oauthTokenMutationAllowed } = await import("@/lib/microsoft/oauth-mutation-policy");
  if (!oauthTokenMutationAllowed()) {
    return config;
  }
  const patch: CalendarConfig = {
    ...config,
    lastTokenRefreshAt: new Date().toISOString(),
    lastTokenRefreshKind: input.kind || (input.ok ? "success" : "unknown"),
    lastTokenRefreshError: input.ok ? null : input.error || "refresh_failed",
    lastTokenRefreshSource: input.source || "production_web",
    lastTokenRefreshBuildSha: input.buildSha ?? null,
    ...(input.scope ? { grantedScopes: input.scope } : {}),
  };
  await getPrisma()
    .voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { config: patch as object },
    })
    .catch(() => undefined);
  return patch;
}

type RefreshSuccess = {
  ok: true;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
};

type RefreshFailure = {
  ok: false;
  result: MicrosoftTokenRefreshResult & { ok: false };
};

async function refreshMicrosoftTokens(refreshToken: string): Promise<RefreshSuccess | RefreshFailure> {
  const refreshed = await refreshMicrosoftAccessToken(refreshToken);
  if (!refreshed.ok) {
    return { ok: false, result: refreshed };
  }
  return {
    ok: true,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresIn: refreshed.expiresIn,
    scope: refreshed.scope,
  };
}

export async function getValidAccessToken(
  connectionId: string,
  provider: string,
  config: CalendarConfig,
  options?: {
    forceRefresh?: boolean;
    /** When true, never refresh or persist token/diagnostic mutations. */
    readOnly?: boolean;
    mutationSource?: import("@/lib/microsoft/oauth-mutation-policy").OAuthMutationSource;
  },
): Promise<string | null> {
  const { oauthTokenMutationAllowed, oauthMutationProvenance } = await import(
    "@/lib/microsoft/oauth-mutation-policy"
  );
  const readOnly = !oauthTokenMutationAllowed({
    readOnly: options?.readOnly,
    mutationSource: options?.mutationSource,
  });
  const forceRefresh = readOnly ? false : (options?.forceRefresh ?? false);
  const provenance = oauthMutationProvenance();

  const resolveTokens = async (activeConfig: CalendarConfig) => {
    const notExpired =
      !forceRefresh &&
      activeConfig.expiresAt &&
      activeConfig.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS;
    if (activeConfig.accessToken && notExpired) return activeConfig.accessToken ?? null;
    if (readOnly) {
      return null;
    }
    if (!activeConfig.refreshToken) {
      const accessStillValid =
        activeConfig.accessToken &&
        activeConfig.expiresAt &&
        activeConfig.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS;
      if (!accessStillValid) {
        await markCalendarConnectionNeedsReauth(connectionId);
      }
      return accessStillValid ? (activeConfig.accessToken ?? null) : null;
    }

    const refreshed =
      provider === "microsoft"
        ? await refreshMicrosoftTokens(activeConfig.refreshToken)
        : await refreshGoogle(activeConfig.refreshToken);

    if (!refreshed || refreshed.ok === false) {
      const failure = refreshed && !refreshed.ok ? refreshed.result : null;
      const needsReconnect =
        failure?.needsReconnect ??
        (failure?.kind === "invalid_grant" ||
          failure?.kind === "interaction_required" ||
          failure?.kind === "consent_required" ||
          failure?.kind === "invalid_client");
      const nextConfig = await persistTokenRefreshDiagnostics(connectionId, activeConfig, {
        ok: false,
        kind: failure?.kind || "unknown",
        error: failure?.error || failure?.errorDescription || "refresh_failed",
        source: provenance.source,
        buildSha: provenance.buildSha,
      });
      if (needsReconnect) {
        await markCalendarConnectionNeedsReauth(connectionId);
      }
      return null;
    }

    const microsoftTenantPatch = (() => {
      if (provider !== "microsoft") return {};
      const patches: Partial<CalendarConfig> = {};
      if (!activeConfig.microsoftUserId) {
        patches.microsoftUserId = extractMicrosoftUserIdFromToken(refreshed.accessToken);
      }
      const tenantId =
        activeConfig.tenantId || extractMicrosoftTenantIdFromToken(refreshed.accessToken);
      if (tenantId) {
        patches.tenantId = tenantId;
        if (!activeConfig.accountType || activeConfig.accountType === "unknown") {
          patches.accountType = inferMicrosoftAccountType(tenantId);
        }
      } else if (!activeConfig.accountType) {
        patches.accountType = "unknown";
      }
      return patches;
    })();

    if (!oauthTokenMutationAllowed({ mutationSource: options?.mutationSource, readOnly: options?.readOnly })) {
      return null;
    }
    const newConfig: CalendarConfig = {
      ...activeConfig,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || activeConfig.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
      ...(refreshed.scope ? { grantedScopes: refreshed.scope } : {}),
      lastTokenRefreshAt: new Date().toISOString(),
      lastTokenRefreshKind: "success",
      lastTokenRefreshError: null,
      lastTokenRefreshSource: provenance.source,
      lastTokenRefreshBuildSha: provenance.buildSha,
      ...microsoftTenantPatch,
    };
    await getPrisma().voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { config: newConfig as object, status: "connected" },
    });
    return refreshed.accessToken;
  };

  if (provider !== "microsoft") {
    try {
      return await resolveTokens(config);
    } catch (err) {
      console.warn("[calendar] token refresh failed", connectionId, err);
      await markCalendarConnectionNeedsReauth(connectionId);
      return null;
    }
  }

  return withMicrosoftTokenRefreshLock(connectionId, async () => {
    try {
      const row = await getPrisma().voiceCalendarConnection.findUnique({
        where: { id: connectionId },
        select: { config: true, status: true },
      });
      const freshConfig = { ...config, ...((row?.config || {}) as CalendarConfig) };
      const notExpired =
        !forceRefresh &&
        freshConfig.expiresAt &&
        freshConfig.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS;
      if (freshConfig.accessToken && notExpired) {
        if (!readOnly && row?.status === "needs_reauth") {
          await markCalendarConnectionConnected(connectionId);
        }
        return freshConfig.accessToken;
      }
      return await resolveTokens(freshConfig);
    } catch (err) {
      console.warn("[calendar] microsoft token refresh failed", connectionId, err);
      await persistTokenRefreshDiagnostics(connectionId, config, {
        ok: false,
        kind: "unknown",
        error: err instanceof Error ? err.message : "refresh_failed",
        source: provenance.source,
        buildSha: provenance.buildSha,
      });
      return null;
    }
  });
}

/** Microsoft Graph fetch with automatic 401 → refresh → retry once. */
export async function microsoftGraphFetch(
  connectionId: string,
  config: CalendarConfig,
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const tokenStarted = Date.now();
  let token = await getValidAccessToken(connectionId, "microsoft", config);
  const tokenValidationMs = Date.now() - tokenStarted;
  try {
    const { recordVoiceTimingField, recordVoiceGraphRequest, getActiveVoiceOrchestratorTiming } =
      await import("@/lib/voice/ai-booking/voice-orchestrator-timing");
    if (getActiveVoiceOrchestratorTiming()) {
      recordVoiceTimingField("tokenValidationMs", tokenValidationMs);
    }
  } catch {
    // voice timing is optional
  }
  if (!token) throw new Error("Microsoft access token unavailable");

  const url = typeof input === "string" ? input : input.toString();
  const graphOp = url.replace(/^https?:\/\/[^/]+/i, "").split("?")[0] || "graph";
  const withAuth = (accessToken: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  const graphStarted = Date.now();
  let res = await withAuth(token);
  const firstGraphMs = Date.now() - graphStarted;
  try {
    const { recordVoiceGraphRequest, getActiveVoiceOrchestratorTiming } = await import(
      "@/lib/voice/ai-booking/voice-orchestrator-timing"
    );
    if (getActiveVoiceOrchestratorTiming()) {
      recordVoiceGraphRequest({
        operation: graphOp,
        httpMs: firstGraphMs,
        status: res.status,
      });
    }
  } catch {
    // optional
  }
  try {
    const { emitVoiceV2GraphSpan } = await import("@/lib/voice-receptionist-wizard/graph-instrumentation");
    emitVoiceV2GraphSpan({ operation: graphOp, httpMs: firstGraphMs, status: res.status });
  } catch {
    // optional
  }
  if (res.status !== 401) return res;

  const refreshStarted = Date.now();
  token = await getValidAccessToken(connectionId, "microsoft", config, { forceRefresh: true });
  try {
    const { recordVoiceTimingField, getActiveVoiceOrchestratorTiming } = await import(
      "@/lib/voice/ai-booking/voice-orchestrator-timing"
    );
    if (getActiveVoiceOrchestratorTiming()) {
      recordVoiceTimingField("tokenRefreshMs", Date.now() - refreshStarted);
    }
  } catch {
    // optional
  }
  if (!token) {
    await markCalendarConnectionNeedsReauth(connectionId);
    throw new Error("Microsoft calendar re-authentication required");
  }

  const retryGraphStarted = Date.now();
  res = await withAuth(token);
  try {
    const { recordVoiceGraphRequest, getActiveVoiceOrchestratorTiming } = await import(
      "@/lib/voice/ai-booking/voice-orchestrator-timing"
    );
    if (getActiveVoiceOrchestratorTiming()) {
      recordVoiceGraphRequest({
        operation: `${graphOp}:retry_after_refresh`,
        httpMs: Date.now() - retryGraphStarted,
        status: res.status,
      });
    }
  } catch {
    // optional
  }
  try {
    const { emitVoiceV2GraphSpan } = await import("@/lib/voice-receptionist-wizard/graph-instrumentation");
    emitVoiceV2GraphSpan({
      operation: `${graphOp}:retry_after_refresh`,
      httpMs: Date.now() - retryGraphStarted,
      status: res.status,
    });
  } catch {
    // optional
  }
  if (res.status === 401) {
    await markCalendarConnectionNeedsReauth(connectionId);
    throw new Error("Microsoft calendars 401");
  }
  if (!res.ok) {
    const graphError = await parseMicrosoftGraphError(res);
    await persistMicrosoftGraphError(connectionId, config, graphError);
    throw new Error(
      graphError.graphMessage || `Microsoft Graph ${graphError.httpStatus}`,
    );
  }
  return res;
}

async function persistMicrosoftGraphError(
  connectionId: string,
  config: CalendarConfig,
  graphError: MicrosoftGraphError,
) {
  await getPrisma()
    .voiceCalendarConnection.update({
      where: { id: connectionId },
      data: {
        config: { ...config, lastGraphError: graphError } as object,
      },
    })
    .catch(() => undefined);
}

/** Authenticated Graph request with optional connection-aware 401 refresh. */
export async function callMicrosoftGraph(
  accessToken: string,
  input: string | URL,
  init?: RequestInit,
  ctx?: MicrosoftGraphContext,
): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (ctx) return microsoftGraphFetch(ctx.connectionId, ctx.config, url, init);
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/** Follow @odata.nextLink / @odata.deltaLink pages and return combined values + final deltaLink. */
export async function collectMicrosoftGraphCollection<T>(
  initialRes: Response,
  accessToken: string,
  ctx?: MicrosoftGraphContext,
): Promise<{ items: T[]; deltaLink?: string }> {
  let res = initialRes;
  const items: T[] = [];
  let deltaLink: string | undefined;
  while (true) {
    if (!res.ok) throw new Error(`Microsoft Graph collection ${res.status}`);
    const json = (await res.json()) as MicrosoftGraphCollectionPage<T>;
    items.push(...(json.value || []));
    const nextLink = json["@odata.nextLink"];
    const pageDeltaLink = json["@odata.deltaLink"];
    if (pageDeltaLink) deltaLink = pageDeltaLink;
    if (!nextLink) break;
    res = await callMicrosoftGraph(accessToken, nextLink, undefined, ctx);
  }
  return { items, deltaLink };
}

async function refreshGoogle(refreshToken: string): Promise<RefreshSuccess | null> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return {
    ok: true,
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string | undefined,
    expiresIn: (json.expires_in as number) || 3600,
  };
}

// --- Calendar listing ----------------------------------------------------

export async function getGoogleCalendars(accessToken: string): Promise<ProviderCalendar[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google calendarList ${res.status}`);
  const json = await res.json();
  const items = (json.items || []) as Array<{ id: string; summary?: string; primary?: boolean }>;
  return items.map((item) => ({
    id: item.id,
    name: item.summary || item.id,
    primary: Boolean(item.primary),
  }));
}

export async function getMicrosoftCalendars(accessToken: string): Promise<ProviderCalendar[]> {
  const res = await fetch(
    `${MICROSOFT_GRAPH_V1}/me/calendars?$select=id,name,isDefaultCalendar,canEdit,owner`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Microsoft calendars ${res.status}`);
  const { items } = await collectMicrosoftGraphCollection<{
    id: string;
    name?: string;
    isDefaultCalendar?: boolean;
    canEdit?: boolean;
    owner?: { name?: string; address?: string };
  }>(res, accessToken);
  return parseMicrosoftCalendarList({ value: items });
}

export async function listMicrosoftCalendarsForConnection(
  connectionId: string,
  config: CalendarConfig,
): Promise<ProviderCalendar[]> {
  const res = await microsoftGraphFetch(
    connectionId,
    config,
    `${MICROSOFT_GRAPH_V1}/me/calendars?$select=id,name,isDefaultCalendar,canEdit,owner`,
  );
  if (!res.ok) throw new Error(`Microsoft calendars ${res.status}`);
  const { items } = await collectMicrosoftGraphCollection<{
    id: string;
    name?: string;
    isDefaultCalendar?: boolean;
    canEdit?: boolean;
    owner?: { name?: string; address?: string };
  }>(res, await getValidAccessToken(connectionId, "microsoft", config) || "", {
    connectionId,
    config,
  });
  return parseMicrosoftCalendarList({ value: items });
}

function parseMicrosoftCalendarList(json: {
  value?: Array<{
    id: string;
    name?: string;
    isDefaultCalendar?: boolean;
    canEdit?: boolean;
    owner?: { name?: string; address?: string };
  }>;
}) {
  const items = json.value || [];
  return items.map((item) => ({
    id: item.id,
    name: item.name || item.id,
    primary: Boolean(item.isDefaultCalendar),
    canEdit: item.canEdit,
    owner: item.owner?.name || item.owner?.address,
  }));
}

// --- Busy lookups --------------------------------------------------------

export async function getGoogleBusy(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId || "primary" }],
    }),
  });
  if (!res.ok) throw new Error(`Google freeBusy ${res.status}`);
  const json = await res.json();
  const cal = json.calendars?.[calendarId || "primary"];
  const busy = (cal?.busy || []) as Array<{ start: string; end: string }>;
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function getMicrosoftBusy(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  opts?: {
    calendarId?: string;
    connectionId?: string;
    config?: CalendarConfig;
    smtp?: string;
    ctx?: MicrosoftGraphContext;
  },
): Promise<BusyInterval[]> {
  const ctx =
    opts?.ctx ||
    (opts?.connectionId && opts?.config
      ? { connectionId: opts.connectionId, config: opts.config }
      : undefined);

  const rawCalendarId = opts?.calendarId?.trim();
  // Voice config uses Google-style "primary"; Graph expects /me/calendar/calendarView or getSchedule.
  const calendarId =
    rawCalendarId && rawCalendarId !== "primary" ? rawCalendarId : undefined;

  if (calendarId) {
    return getMicrosoftBusyViaCalendarView(accessToken, timeMin, timeMax, calendarId, ctx);
  }

  const smtp = opts?.smtp || opts?.config?.email;
  const accountType = resolveMicrosoftAccountType({
    accountType: opts?.config?.accountType,
    tenantId: opts?.config?.tenantId,
  });
  if (ctx && smtp && canUseMicrosoftGetSchedule(accountType)) {
    return getMicrosoftBusyViaGetSchedule(ctx.connectionId, ctx.config, timeMin, timeMax, smtp);
  }

  return getMicrosoftBusyViaCalendarView(accessToken, timeMin, timeMax, undefined, ctx);
}

/** Free/busy via calendar: getSchedule (documented availability API). */
async function getMicrosoftBusyViaGetSchedule(
  connectionId: string,
  config: CalendarConfig,
  timeMin: Date,
  timeMax: Date,
  smtp: string,
): Promise<BusyInterval[]> {
  const res = await microsoftGraphFetch(connectionId, config, `${MICROSOFT_GRAPH_V1}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: GRAPH_PREFER_OUTLOOK_UTC,
    },
    body: JSON.stringify({
      schedules: [smtp],
      startTime: toMicrosoftDateTimeTimeZone(timeMin, "UTC"),
      endTime: toMicrosoftDateTimeTimeZone(timeMax, "UTC"),
      availabilityViewInterval: 30,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft getSchedule ${res.status}`);
  const json = await res.json();
  const schedules = (json.value || []) as Array<{
    scheduleItems?: Array<{
      status?: string;
      start?: { dateTime: string; timeZone?: string };
      end?: { dateTime: string; timeZone?: string };
    }>;
  }>;
  const items = schedules.flatMap((s) => s.scheduleItems || []);
  return items
    .filter((item) => isMicrosoftBusyScheduleStatus(item.status))
    .map((item) => ({
      start: parseMicrosoftGraphDateTime(item.start?.dateTime || "", item.start?.timeZone || "UTC"),
      end: parseMicrosoftGraphDateTime(item.end?.dateTime || "", item.end?.timeZone || "UTC"),
    }));
}

async function getMicrosoftBusyViaCalendarView(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId?: string,
  ctx?: MicrosoftGraphContext,
): Promise<BusyInterval[]> {
  const url = new URL(microsoftCalendarViewUrl(calendarId));
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  url.searchParams.set("$select", "start,end,showAs");
  url.searchParams.set("$top", "250");

  const res = await callMicrosoftGraph(accessToken, url.toString(), {
    headers: { Prefer: GRAPH_PREFER_OUTLOOK_UTC },
  }, ctx);

  if (!res.ok) throw new Error(`Microsoft calendarView ${res.status}`);
  const { items: events } = await collectMicrosoftGraphCollection<{
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    showAs?: string;
    isCancelled?: boolean;
  }>(res, accessToken, ctx);

  return events
    .filter((e) => !e.isCancelled && isMicrosoftBusyShowAs(e.showAs))
    .map((e) => ({
      start: parseMicrosoftGraphDateTime(e.start.dateTime, e.start.timeZone || "UTC"),
      end: parseMicrosoftGraphDateTime(e.end.dateTime, e.end.timeZone || "UTC"),
    }));
}

export type ProviderCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
  status: "confirmed" | "cancelled";
  attendees?: Array<{ email?: string; name?: string; responseStatus?: string }>;
  organizerEmail?: string;
  updatedAt?: Date;
  isAllDay?: boolean;
  transovoOriginated?: boolean;
  seriesMasterId?: string;
  type?: string;
  recurrence?: unknown;
  originalStart?: Date;
};

export function resolveImportCalendarIds(config: CalendarConfig) {
  return config.importCalendarIds || [];
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<ProviderCalendarEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
  );
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "true");
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google events.list ${res.status}`);
  const json = await res.json();
  const items = (json.items || []) as Array<{
    id: string;
    status?: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    updated?: string;
    attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
    organizer?: { email?: string };
    transparency?: string;
    extendedProperties?: { private?: Record<string, string> };
  }>;

  return items
    .filter((item) => item.transparency !== "transparent")
    .map((item) => {
      const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
      const startRaw = item.start?.dateTime || item.start?.date;
      const endRaw = item.end?.dateTime || item.end?.date;
      const start = startRaw ? new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw) : new Date();
      const end = endRaw
        ? new Date(isAllDay ? `${endRaw}T00:00:00Z` : endRaw)
        : new Date(start.getTime() + 30 * 60_000);
      return {
        id: item.id,
        summary: item.summary || "Calendar event",
        description: item.description,
        start,
        end,
        timezone: item.start?.timeZone,
        status: item.status === "cancelled" ? "cancelled" : "confirmed",
        attendees: (item.attendees || []).map((a) => ({
          email: a.email,
          name: a.displayName,
          responseStatus: a.responseStatus,
        })),
        organizerEmail: item.organizer?.email,
        updatedAt: item.updated ? new Date(item.updated) : undefined,
        isAllDay,
        transovoOriginated: Boolean(item.extendedProperties?.private?.transovoAppointmentId),
      };
    });
}

export async function getGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<ProviderCalendarEvent | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Google events.get ${res.status}`);
  const item = await res.json();
  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  const start = startRaw ? new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw) : new Date();
  const end = endRaw
    ? new Date(isAllDay ? `${endRaw}T00:00:00Z` : endRaw)
    : new Date(start.getTime() + 30 * 60_000);
  return {
    id: item.id,
    summary: item.summary || "Calendar event",
    description: item.description,
    start,
    end,
    timezone: item.start?.timeZone,
    status: item.status === "cancelled" ? "cancelled" : "confirmed",
    attendees: (item.attendees || []).map((a: { email?: string; displayName?: string; responseStatus?: string }) => ({
      email: a.email,
      name: a.displayName,
      responseStatus: a.responseStatus,
    })),
    organizerEmail: item.organizer?.email,
    updatedAt: item.updated ? new Date(item.updated) : undefined,
    isAllDay,
    transovoOriginated: Boolean(item.extendedProperties?.private?.transovoAppointmentId),
  };
}

export async function getMicrosoftCalendarEvent(
  accessToken: string,
  eventId: string,
  ctx?: MicrosoftGraphContext,
): Promise<ProviderCalendarEvent | null> {
  const url = `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(eventId)}?$select=id,subject,bodyPreview,start,end,isCancelled,showAs,attendees,organizer,lastModifiedDateTime,isAllDay`;
  const res = await callMicrosoftGraph(accessToken, url, {
    headers: { Prefer: GRAPH_PREFER_OUTLOOK_UTC },
  }, ctx);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Microsoft events.get ${res.status}`);
  const item = await res.json();
  if (item.showAs === "free") return null;
  return {
    id: item.id,
    summary: item.subject || "Calendar event",
    description: item.bodyPreview,
    start: parseMicrosoftEventDateTime(item.start, item.isAllDay),
    end: parseMicrosoftEventDateTime(item.end, item.isAllDay),
    timezone: item.start?.timeZone,
    status: item.isCancelled ? "cancelled" : "confirmed",
    attendees: (item.attendees || []).map((a: { emailAddress?: { address?: string; name?: string }; status?: { response?: string } }) => ({
      email: a.emailAddress?.address,
      name: a.emailAddress?.name,
      responseStatus: a.status?.response,
    })),
    organizerEmail: item.organizer?.emailAddress?.address,
    updatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
    isAllDay: Boolean(item.isAllDay),
    transovoOriginated: false,
  };
}

export async function listMicrosoftCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId?: string,
  ctx?: MicrosoftGraphContext,
): Promise<ProviderCalendarEvent[]> {
  const url = new URL(microsoftCalendarViewUrl(calendarId));
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  url.searchParams.set(
    "$select",
    "id,subject,bodyPreview,start,end,isCancelled,showAs,attendees,organizer,lastModifiedDateTime,isAllDay,seriesMasterId,type,recurrence,originalStart,transactionId",
  );
  url.searchParams.set("$top", "250");

  const res = await callMicrosoftGraph(accessToken, url.toString(), {
    headers: { Prefer: GRAPH_PREFER_OUTLOOK_UTC },
  }, ctx);
  if (!res.ok) throw new Error(`Microsoft events.list ${res.status}`);

  const { items } = await collectMicrosoftGraphCollection<{
    id: string;
    subject?: string;
    bodyPreview?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    isCancelled?: boolean;
    showAs?: string;
    isAllDay?: boolean;
    lastModifiedDateTime?: string;
    seriesMasterId?: string;
    type?: string;
    recurrence?: unknown;
    originalStart?: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ emailAddress?: { address?: string; name?: string }; status?: { response?: string } }>;
    organizer?: { emailAddress?: { address?: string } };
    "@removed"?: { reason?: string };
  }>(res, accessToken, ctx);

  return items
    .filter((item) => !item["@removed"])
    .filter((item) => isMicrosoftBusyShowAs(item.showAs) || item.isCancelled)
    .map((item) => mapMicrosoftGraphEvent(item));
}

export function mapMicrosoftGraphEvent(item: {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  isCancelled?: boolean;
  showAs?: string;
  isAllDay?: boolean;
  lastModifiedDateTime?: string;
  seriesMasterId?: string;
  type?: string;
  recurrence?: unknown;
  originalStart?: { dateTime?: string; date?: string; timeZone?: string };
  transactionId?: string;
  attendees?: Array<{ emailAddress?: { address?: string; name?: string }; status?: { response?: string } }>;
  organizer?: { emailAddress?: { address?: string } };
  "@removed"?: { reason?: string };
}): ProviderCalendarEvent {
  const transovoOriginated = Boolean(item.transactionId);
  return {
    id: item.id,
    summary: item.subject || "Calendar event",
    description: item.bodyPreview,
    start: parseMicrosoftEventDateTime(item.start, item.isAllDay),
    end: parseMicrosoftEventDateTime(item.end, item.isAllDay),
    timezone: item.start?.timeZone,
    status: item.isCancelled ? "cancelled" : "confirmed",
    attendees: (item.attendees || []).map((a) => ({
      email: a.emailAddress?.address,
      name: a.emailAddress?.name,
      responseStatus: a.status?.response,
    })),
    organizerEmail: item.organizer?.emailAddress?.address,
    updatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
    isAllDay: Boolean(item.isAllDay),
    transovoOriginated,
    seriesMasterId: item.seriesMasterId,
    type: item.type,
    recurrence: item.recurrence,
    originalStart: item.originalStart
      ? parseMicrosoftEventDateTime(item.originalStart, item.isAllDay)
      : undefined,
  };
}

// --- Event create / update / delete --------------------------------------

export async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    timezone?: string;
    transovoAppointmentId?: string;
  },
): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString(), timeZone: event.timezone || "UTC" },
        end: { dateTime: event.end.toISOString(), timeZone: event.timezone || "UTC" },
        extendedProperties: event.transovoAppointmentId
          ? { private: { transovoAppointmentId: event.transovoAppointmentId } }
          : undefined,
      }),
    },
  );
  if (!res.ok) throw new Error(`Google events.insert ${res.status}`);
  const json = await res.json();
  return (json.id as string) || null;
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: { summary?: string; description?: string; start?: Date; end?: Date; timezone?: string },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (event.summary !== undefined) body.summary = event.summary;
  if (event.description !== undefined) body.description = event.description;
  if (event.start) {
    body.start = { dateTime: event.start.toISOString(), timeZone: event.timezone || "UTC" };
  }
  if (event.end) {
    body.end = { dateTime: event.end.toISOString(), timeZone: event.timezone || "UTC" };
  }
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Google events.update ${res.status}`);
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404) throw new Error(`Google events.delete ${res.status}`);
}

export async function insertMicrosoftEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    timezone?: string;
    calendarId?: string;
    transovoAppointmentId?: string;
    transactionId?: string;
    location?: string;
    attendees?: Array<{ email: string; name?: string }>;
  },
  ctx?: MicrosoftGraphContext,
): Promise<string | null> {
  const url = event.calendarId
    ? `${MICROSOFT_GRAPH_V1}/me/calendars/${encodeURIComponent(event.calendarId)}/events`
    : `${MICROSOFT_GRAPH_V1}/me/events`;
  const transactionId = event.transactionId || event.transovoAppointmentId;
  const res = await callMicrosoftGraph(accessToken, url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.summary,
      body: { contentType: "HTML", content: event.description || "" },
      start: toMicrosoftDateTimeTimeZone(event.start, event.timezone || "UTC"),
      end: toMicrosoftDateTimeTimeZone(event.end, event.timezone || "UTC"),
      ...(event.location ? { location: { displayName: event.location } } : {}),
      ...(event.attendees?.length
        ? {
            attendees: event.attendees.map((a) => ({
              emailAddress: { address: a.email, name: a.name || a.email },
              type: "required",
            })),
          }
        : {}),
      ...(transactionId ? { transactionId } : {}),
    }),
  }, ctx);
  if (!res.ok) throw new Error(`Microsoft events.insert ${res.status}`);
  const json = await res.json();
  return (json.id as string) || null;
}

export async function updateMicrosoftEvent(
  accessToken: string,
  eventId: string,
  event: { summary?: string; description?: string; start?: Date; end?: Date; timezone?: string },
  ctx?: MicrosoftGraphContext,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (event.summary !== undefined) body.subject = event.summary;
  if (event.description !== undefined) {
    body.body = { contentType: "text", content: event.description };
  }
  if (event.start) {
    body.start = toMicrosoftDateTimeTimeZone(event.start, event.timezone || "UTC");
  }
  if (event.end) {
    body.end = toMicrosoftDateTimeTimeZone(event.end, event.timezone || "UTC");
  }
  const res = await callMicrosoftGraph(
    accessToken,
    `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    ctx,
  );
  if (!res.ok) throw new Error(`Microsoft events.update ${res.status}`);
}

export async function refreshMicrosoftMailboxTimezone(
  connectionId: string,
  config: CalendarConfig,
): Promise<string | undefined> {
  const res = await microsoftGraphFetch(
    connectionId,
    config,
    `${MICROSOFT_GRAPH_V1}/me/mailboxSettings?$select=timeZone`,
  );
  if (!res.ok) return undefined;
  const json = (await res.json()) as { timeZone?: string };
  return json.timeZone?.trim() || undefined;
}

export async function deleteMicrosoftEvent(
  accessToken: string,
  eventId: string,
  ctx?: MicrosoftGraphContext,
): Promise<void> {
  const res = await callMicrosoftGraph(
    accessToken,
    `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
    ctx,
  );
  if (!res.ok && res.status !== 404) throw new Error(`Microsoft events.delete ${res.status}`);
}

/** Cancel a Microsoft event and notify attendees (organizer cancellation). */
export async function cancelMicrosoftEvent(
  accessToken: string,
  eventId: string,
  opts?: { comment?: string },
  ctx?: MicrosoftGraphContext,
): Promise<void> {
  const res = await callMicrosoftGraph(
    accessToken,
    `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(eventId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: opts?.comment || "Canceled" }),
    },
    ctx,
  );
  if (!res.ok && res.status !== 404) throw new Error(`Microsoft events.cancel ${res.status}`);
}

/**
 * Cancel with attendee notification when appropriate, otherwise delete.
 * Used for Transovo-owned Microsoft events only.
 */
export async function cancelOrDeleteMicrosoftEvent(
  accessToken: string,
  eventId: string,
  opts: { hasAttendees: boolean; comment?: string },
  ctx?: MicrosoftGraphContext,
): Promise<void> {
  if (opts.hasAttendees) {
    await cancelMicrosoftEvent(accessToken, eventId, { comment: opts.comment }, ctx);
    return;
  }
  await deleteMicrosoftEvent(accessToken, eventId, ctx);
}

/**
 * Compute open slots within business hours (9-17 local) over `days`, excluding
 * any busy intervals returned by the provider.
 */
export function computeFreeSlots(
  busy: BusyInterval[],
  durationMinutes: number,
  days: number,
  now = new Date(),
  bufferMinutes = 0,
  opts?: {
    timezone?: string;
    startHour?: number;
    endHour?: number;
    weekdaysOnly?: boolean;
  },
): Array<{ startsAt: string; endsAt: string }> {
  const bufferMs = bufferMinutes * 60_000;
  const slots: Array<{ startsAt: string; endsAt: string }> = [];
  const tz = (opts?.timezone || "").trim();
  const startHour = opts?.startHour ?? 9;
  const endHour = opts?.endHour ?? 17;
  const weekdaysOnly = opts?.weekdaysOnly ?? true;

  if (tz) {
    const today = zonedDateParts(now, tz);
    for (let d = 0; d < days; d += 1) {
      const day = addCalendarDays(today.year, today.month, today.day, d);
      const noon = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, 12, 0);
      const weekday = zonedDateParts(noon, tz).weekday;
      if (weekdaysOnly && (weekday === "sat" || weekday === "sun")) continue;
      for (let hour = startHour; hour < endHour; hour += 1) {
        const start = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, hour, 0);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        if (start <= now) continue;
        const overlaps = busy.some((b) => {
          const bufferedStart = new Date(b.start.getTime() - bufferMs);
          const bufferedEnd = new Date(b.end.getTime() + bufferMs);
          return start < bufferedEnd && end > bufferedStart;
        });
        if (!overlaps) {
          slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
        }
      }
    }
    return slots.slice(0, 20);
  }

  for (let d = 0; d < days; d += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    if (weekdaysOnly) {
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
    }
    for (let hour = startHour; hour < endHour; hour += 1) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      if (start <= now) continue;
      const overlaps = busy.some((b) => {
        const bufferedStart = new Date(b.start.getTime() - bufferMs);
        const bufferedEnd = new Date(b.end.getTime() + bufferMs);
        return start < bufferedEnd && end > bufferedStart;
      });
      if (!overlaps) {
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
      }
    }
  }
  return slots.slice(0, 20);
}
