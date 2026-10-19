import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";

export type SchedulingBackend =
  | { ok: true; provider: "calendly"; connectionId: string; eventTypeUri?: string | null }
  | { ok: true; provider: "microsoft"; connectionId: string; calendarId: string }
  | { ok: true; provider: "google"; connectionId: string; calendarId: string }
  | { ok: false; code: string; message: string };

const CONNECTED = ["connected", "active", "ok"];

export async function resolveSchedulingBackend(
  workspaceId: string,
  editor: AgentConfig,
): Promise<SchedulingBackend> {
  const provider = editor.appointments.provider;
  const prisma = getPrisma();

  if (provider === "none" || editor.appointments.strategy !== "live") {
    return { ok: false, code: "scheduling_disabled", message: "Live calendar booking is not configured." };
  }

  if (provider === "calendly") {
    const row = await prisma.integrationConnection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "calendly" } },
    });
    if (!row?.accessToken || !CONNECTED.includes(row.status)) {
      return {
        ok: false,
        code: "calendly_not_connected",
        message: "Connect Calendly in Integrations before publishing live booking.",
      };
    }
    const cfg = (row.configJson || {}) as Record<string, unknown>;
    const eventTypeUri =
      typeof cfg.defaultEventTypeUri === "string" ? cfg.defaultEventTypeUri : null;
    return { ok: true, provider: "calendly", connectionId: row.id, eventTypeUri };
  }

  if (provider === "microsoft" || provider === "google") {
    const row = await prisma.voiceCalendarConnection.findFirst({
      where: {
        workspaceId,
        provider,
        status: { in: CONNECTED },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      return {
        ok: false,
        code: `${provider}_not_connected`,
        message: `Connect ${provider === "microsoft" ? "Microsoft 365" : "Google"} calendar before publishing live booking.`,
      };
    }
    const cfg = (row.config || {}) as Record<string, unknown>;
    const calendarId =
      (typeof cfg.calendarId === "string" && cfg.calendarId) ||
      (typeof cfg.writeCalendarId === "string" && cfg.writeCalendarId) ||
      "primary";
    if (!cfg.accessToken && !cfg.refreshToken && !row.credentialsRef) {
      return {
        ok: false,
        code: `${provider}_missing_tokens`,
        message: `${provider} calendar connection is missing OAuth credentials — reconnect the calendar.`,
      };
    }
    return { ok: true, provider, connectionId: row.id, calendarId };
  }

  return { ok: false, code: "unsupported_provider", message: `Unsupported calendar provider: ${provider}` };
}
