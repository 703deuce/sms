import "server-only";

import { getPrisma } from "@/lib/db";
import {
  getMicrosoftOAuthScopes,
} from "@/lib/microsoft/oauth-config";
import {
  canUseMicrosoftGetSchedule,
  resolveMicrosoftAccountType,
  type MicrosoftAccountType,
} from "@/lib/microsoft/graph-helpers";
import {
  getValidAccessToken,
  hasOAuthTokens,
  listMicrosoftCalendarsForConnection,
  resolveWriteCalendarId,
  type CalendarConfig,
} from "@/lib/calendar/providers";

export type MicrosoftCalendarHealth =
  | "CONNECTED"
  | "CONNECTED_MISSING_SCOPES"
  | "CONNECTED_NO_REFRESH"
  | "NEEDS_RECONNECT"
  | "CALENDAR_NOT_SELECTED"
  | "CALENDAR_READ_ONLY"
  | "AI_BOOKING_READY"
  | "AI_BOOKING_PARTIAL"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "DISCONNECTED";

export type MicrosoftCalendarCapabilities = {
  connected: boolean;
  health: MicrosoftCalendarHealth;
  accountType: MicrosoftAccountType;
  scopesRequested: string;
  scopesGranted: string | null;
  hasRefreshToken: boolean;
  canListCalendars: boolean;
  canReadEvents: boolean;
  canWriteEvents: boolean;
  canGetSchedule: boolean;
  canFindMeetingTimes: boolean;
  canCreateBooking: boolean;
  canUpdateBooking: boolean;
  canCancelBooking: boolean;
  canCreateOnlineMeetingEvent: boolean;
  nativeApiReschedule: true;
  calendarSelected: boolean;
  calendarEditable: boolean;
  needsReconnect: boolean;
  notes: string[];
};

function scopesInclude(scopes: string | null, needle: string): boolean {
  if (!scopes) return true; // unknown — do not block on stale scope metadata
  return scopes.toLowerCase().includes(needle.toLowerCase());
}

export async function getMicrosoftCalendarCapabilities(
  workspaceId: string,
  opts?: { calendarConnectionId?: string | null },
): Promise<MicrosoftCalendarCapabilities> {
  const notes: string[] = [];
  const prisma = getPrisma();
  const conn = opts?.calendarConnectionId
    ? await prisma.voiceCalendarConnection.findFirst({
        where: { id: opts.calendarConnectionId, workspaceId, provider: "microsoft" },
      })
    : await prisma.voiceCalendarConnection.findFirst({
        where: { workspaceId, provider: "microsoft", status: "connected" },
        orderBy: { createdAt: "asc" },
      });

  const empty: MicrosoftCalendarCapabilities = {
    connected: false,
    health: "DISCONNECTED",
    accountType: "unknown",
    scopesRequested: getMicrosoftOAuthScopes(),
    scopesGranted: null,
    hasRefreshToken: false,
    canListCalendars: false,
    canReadEvents: false,
    canWriteEvents: false,
    canGetSchedule: false,
    canFindMeetingTimes: false,
    canCreateBooking: false,
    canUpdateBooking: false,
    canCancelBooking: false,
    canCreateOnlineMeetingEvent: false,
    nativeApiReschedule: true,
    calendarSelected: false,
    calendarEditable: false,
    needsReconnect: false,
    notes: ["Microsoft calendar not connected"],
  };

  if (!conn) return empty;

  const config = (conn.config || {}) as CalendarConfig;
  const connected = conn.status === "connected" && hasOAuthTokens(config);
  const accountType = resolveMicrosoftAccountType({
    accountType: config.accountType,
    tenantId: config.tenantId,
  });

  if (conn.status === "needs_reauth") {
    return {
      ...empty,
      connected: false,
      health: "NEEDS_RECONNECT",
      accountType,
      needsReconnect: true,
      notes: ["Microsoft calendar needs re-authentication"],
    };
  }

  if (!connected) {
    return { ...empty, accountType, notes: ["Missing or expired OAuth tokens"] };
  }

  const hasRefresh = Boolean(config.refreshToken);
  if (!hasRefresh) {
    notes.push("No refresh token — reconnect with offline_access for unattended AI Booking");
  }

  const scopesGranted =
    typeof config.scope === "string" ? config.scope : typeof config.scopes === "string" ? config.scopes : null;
  const missingWrite = scopesGranted && !scopesInclude(scopesGranted, "Calendars.ReadWrite");

  const canGetSchedule = canUseMicrosoftGetSchedule(accountType);
  const canFindMeetingTimes = accountType === "organizational";
  if (accountType === "personal") {
    notes.push("Personal Microsoft account: getSchedule/findMeetingTimes unavailable — calendarView fallback");
  }

  let calendarEditable = false;
  let calendarSelected = Boolean(opts?.calendarConnectionId || config.writeCalendarId || config.calendarId);
  const writeCalId = resolveWriteCalendarId(config);

  try {
    const token = await getValidAccessToken(conn.id, "microsoft", config);
    if (!token) {
      return {
        ...empty,
        connected: true,
        health: "NEEDS_RECONNECT",
        accountType,
        needsReconnect: true,
        notes: ["Could not obtain access token"],
      };
    }
    const calendars = await listMicrosoftCalendarsForConnection(conn.id, config);
    const target = calendars.find((c) => c.id === writeCalId) || calendars.find((c) => c.primary);
    if (target) {
      calendarEditable = target.canEdit !== false;
      calendarSelected = true;
      if (!calendarEditable) notes.push("Selected calendar is read-only for create/update");
    } else if (writeCalId && writeCalId !== "primary") {
      notes.push("Configured write calendar not found in mailbox");
    }
  } catch (err) {
    notes.push(err instanceof Error ? err.message : String(err));
    return {
      ...empty,
      connected: true,
      health: "PROVIDER_UNAVAILABLE",
      accountType,
      hasRefreshToken: hasRefresh,
      scopesGranted,
      notes,
    };
  }

  const canWrite = !missingWrite && calendarEditable;
  const canCreate = canWrite && hasRefresh;
  let health: MicrosoftCalendarHealth = "CONNECTED";
  if (!hasRefresh) health = "CONNECTED_NO_REFRESH";
  else if (missingWrite) health = "CONNECTED_MISSING_SCOPES";
  else if (!calendarSelected) health = "CALENDAR_NOT_SELECTED";
  else if (!calendarEditable) health = "CALENDAR_READ_ONLY";
  else if (canCreate) health = "AI_BOOKING_READY";
  else health = "AI_BOOKING_PARTIAL";

  return {
    connected: true,
    health,
    accountType,
    scopesRequested: getMicrosoftOAuthScopes(),
    scopesGranted,
    hasRefreshToken: hasRefresh,
    canListCalendars: true,
    canReadEvents: true,
    canWriteEvents: canWrite,
    canGetSchedule,
    canFindMeetingTimes,
    canCreateBooking: canCreate,
    canUpdateBooking: canWrite,
    canCancelBooking: canWrite,
    canCreateOnlineMeetingEvent: canWrite,
    nativeApiReschedule: true,
    calendarSelected,
    calendarEditable,
    needsReconnect: false,
    notes,
  };
}
