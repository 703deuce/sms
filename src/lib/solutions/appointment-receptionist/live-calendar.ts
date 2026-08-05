/**
 * Shared live-calendar detection for wizard Appointments + Activate steps.
 * Mirrors activate-hooks: VoiceCalendarConnection (google/microsoft/internal/calendly)
 * OR Integrations Calendly connection.
 */

export const LIVE_VOICE_CALENDAR_PROVIDERS = [
  "google",
  "microsoft",
  "internal",
  "calendly",
] as const;

export type LiveCalendarProvider = (typeof LIVE_VOICE_CALENDAR_PROVIDERS)[number];

export type VoiceCalendarRow = {
  id?: string;
  name?: string;
  provider?: string;
  status?: string;
};

export type IntegrationConnectionRow = {
  provider?: string;
  status?: string;
  config?: Record<string, unknown> | null;
};

export function isLiveCalendarStatus(status: string | null | undefined): boolean {
  return ["connected", "active", "ok"].includes(String(status || "").toLowerCase());
}

export function isLiveVoiceCalendarProvider(
  provider: string | null | undefined,
): provider is LiveCalendarProvider {
  return LIVE_VOICE_CALENDAR_PROVIDERS.includes(
    String(provider || "") as LiveCalendarProvider,
  );
}

export type ResolvedLiveCalendar = {
  connected: boolean;
  provider: string | null;
  name: string | null;
  source: "voice_calendar" | "integrations" | null;
};

/**
 * Resolve whether the workspace has a calendar the booking agent can use.
 */
export function resolveLiveCalendar(input: {
  voiceCalendars?: VoiceCalendarRow[] | null;
  integrationConnections?: IntegrationConnectionRow[] | null;
}): ResolvedLiveCalendar {
  const rows = input.voiceCalendars || [];
  const voice = rows.find(
    (r) =>
      isLiveVoiceCalendarProvider(r.provider) && isLiveCalendarStatus(r.status),
  );
  if (voice) {
    return {
      connected: true,
      provider: String(voice.provider),
      name: voice.name || String(voice.provider),
      source: "voice_calendar",
    };
  }

  const integrations = input.integrationConnections || [];
  const calendly = integrations.find(
    (c) =>
      String(c.provider || "").toLowerCase() === "calendly" &&
      isLiveCalendarStatus(c.status),
  );
  if (calendly) {
    const cfg = (calendly.config || {}) as Record<string, unknown>;
    const email =
      (typeof cfg.email === "string" && cfg.email) ||
      (typeof cfg.schedulingUrl === "string" && cfg.schedulingUrl) ||
      "Calendly";
    return {
      connected: true,
      provider: "calendly",
      name: email,
      source: "integrations",
    };
  }

  return { connected: false, provider: null, name: null, source: null };
}
