import type { CalendarConfig } from "@/lib/voice/calendar/providers";

function resolveWriteCalendarIdLocal(config: CalendarConfig): string {
  return config.writeCalendarId || config.calendarId || "primary";
}

export type ArCalendarReadinessLevel = 0 | 1 | 2 | 3 | 4;

export type ArCalendarReadiness = {
  level: ArCalendarReadinessLevel;
  connected: boolean;
  readable: boolean;
  writeScopesOk: boolean;
  writeCalendarOk: boolean;
  summary: string;
  provider?: string;
  connectionStatus?: string;
};

function hasWriteScopes(provider: string, config: CalendarConfig): boolean {
  const raw = (config as { oauthScopes?: string[]; scopes?: string[] }).oauthScopes
    || (config as { scopes?: string[] }).scopes
    || [];
  const joined = Array.isArray(raw) ? raw.join(" ") : String(raw);
  if (provider === "google") {
    return /calendar\.events|calendar\b/.test(joined) || Boolean(config.refreshToken);
  }
  return /Calendars\.ReadWrite|calendar\.readwrite/i.test(joined) || Boolean(config.refreshToken);
}

export function evaluateArCalendarReadiness(input: {
  provider?: string | null;
  connectionStatus?: string | null;
  config?: CalendarConfig | null;
}): ArCalendarReadiness {
  const provider = input.provider || undefined;
  const status = input.connectionStatus || undefined;
  const config = input.config || {};
  const connected =
    Boolean(provider) && (status === "connected" || status === "needs_reauth");
  const readable = connected && Boolean(config.importCalendarIds?.length || config.calendarId);
  const writeScopesOk = connected && hasWriteScopes(provider || "microsoft", config);
  const writeId = provider ? resolveWriteCalendarIdLocal(config) : "";
  const writeCalendarOk = writeScopesOk && Boolean(writeId);

  let level: ArCalendarReadinessLevel = 0;
  if (connected && readable) level = 1;
  if (level >= 1 && writeScopesOk) level = 2;
  if (level >= 2 && writeCalendarOk) level = 3;

  const summary =
    level >= 3
      ? "Calendar connected with write access"
      : level === 2
        ? "Connected — confirm write calendar is selected"
        : level === 1
          ? "Connected for import — write scopes or calendar may be missing"
          : "No connected calendar";

  return {
    level,
    connected,
    readable: Boolean(readable),
    writeScopesOk,
    writeCalendarOk,
    summary,
    provider,
    connectionStatus: status,
  };
}
