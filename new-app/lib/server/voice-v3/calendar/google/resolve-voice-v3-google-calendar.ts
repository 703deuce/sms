import "server-only";

import type { VoiceV3AgentConfig } from "../../config/agent-config";
import type { CalendarConfig } from "@/lib/voice/calendar/providers";

export type ResolvedVoiceV3GoogleCalendar =
  | {
      ok: true;
      connectionId: string;
      calendarConfig: CalendarConfig;
      calendarIds: string[];
    }
  | { ok: false; message: string };

export async function resolveVoiceV3GoogleCalendar(
  config: VoiceV3AgentConfig,
): Promise<ResolvedVoiceV3GoogleCalendar> {
  const connectionId = config.calendar?.connectionId;
  const calendarIds = config.calendar?.calendarIds?.length
    ? config.calendar.calendarIds
    : ["primary"];
  if (!connectionId) {
    return { ok: false, message: "Calendar not configured on agent" };
  }

  const { getPrisma } = await import("@/lib/server/db");
  const prisma = getPrisma();
  const connection = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, provider: "google" },
  });
  const connected = connection && ["connected", "active", "ok"].includes(connection.status);
  if (!connection || !connected) {
    return { ok: false, message: "Google Calendar connection not found or not connected" };
  }

  return {
    ok: true,
    connectionId: connection.id,
    calendarConfig: (connection.config || {}) as CalendarConfig,
    calendarIds: [...calendarIds],
  };
}
