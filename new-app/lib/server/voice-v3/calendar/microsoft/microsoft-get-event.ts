import "server-only";

import { getValidAccessToken, hasOAuthTokens, type CalendarConfig } from "@/lib/voice/calendar/providers";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type MicrosoftEventSnapshot = {
  id: string;
  isCancelled?: boolean;
  startUtc: string;
  endUtc: string;
};

export async function fetchMicrosoftEventById(input: {
  connectionId: string;
  calendarConfig: CalendarConfig;
  providerEventId: string;
  timeoutMs?: number;
}): Promise<
  | { ok: true; event: MicrosoftEventSnapshot; durationMs: number }
  | { ok: false; reason: "not_found" | "auth" | "error"; message: string; durationMs: number }
> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 12_000;
  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "auth",
        message: "missing tokens",
        durationMs: Date.now() - started,
      };
    }
    const token = await getValidAccessToken(input.connectionId, "microsoft", input.calendarConfig);
    const res = await fetch(
      `${GRAPH}/me/events/${encodeURIComponent(input.providerEventId)}?$select=id,isCancelled,start,end`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (res.status === 404) {
      return { ok: false, reason: "not_found", message: "404", durationMs: Date.now() - started };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: "error",
        message: `status ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const json = (await res.json()) as {
      id?: string;
      isCancelled?: boolean;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
    };
    if (!json.id || !json.start?.dateTime || !json.end?.dateTime) {
      return {
        ok: false,
        reason: "error",
        message: "malformed event",
        durationMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      event: {
        id: json.id,
        isCancelled: json.isCancelled,
        startUtc: new Date(json.start.dateTime).toISOString(),
        endUtc: new Date(json.end.dateTime).toISOString(),
      },
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}
