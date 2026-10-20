import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  getMicrosoftAccessToken,
  microsoftGetBusy,
} from "@/lib/server/voice-v3/scheduling/microsoft-oauth";

export type CalendarConfig = {
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  calendarId?: string;
  writeCalendarId?: string;
  email?: string;
  timezone?: string;
};

export type BusyInterval = { start: Date; end: Date };

export function hasOAuthTokens(config: CalendarConfig): boolean {
  return Boolean(config.refreshToken || config.accessToken);
}

export async function getValidAccessToken(
  connectionId: string,
  provider: string,
  _config: CalendarConfig,
): Promise<string> {
  if (provider !== "microsoft") {
    throw new Error(`getValidAccessToken: unsupported provider ${provider}`);
  }
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId },
    select: { workspaceId: true },
  });
  if (!row?.workspaceId) throw new Error("Calendar connection not found");
  return getMicrosoftAccessToken(row.workspaceId, connectionId);
}

export async function getMicrosoftBusy(
  _token: string,
  timeMin: Date,
  timeMax: Date,
  ctx: {
    calendarId: string;
    connectionId: string;
    config: CalendarConfig;
    smtp?: string;
  },
): Promise<BusyInterval[]> {
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: ctx.connectionId },
    select: { workspaceId: true },
  });
  if (!row?.workspaceId) throw new Error("Calendar connection not found");
  const busy = await microsoftGetBusy({
    workspaceId: row.workspaceId,
    connectionId: ctx.connectionId,
    calendarId: ctx.calendarId,
    rangeStart: timeMin,
    rangeEnd: timeMax,
  });
  return busy.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}
