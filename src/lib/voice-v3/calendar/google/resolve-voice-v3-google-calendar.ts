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

/**
 * Same Google connection + calendar ids used by V3 FIND/BOOK.
 */
export async function resolveVoiceV3GoogleCalendar(
  config: VoiceV3AgentConfig,
): Promise<ResolvedVoiceV3GoogleCalendar> {
  const connectionId = config.calendar?.connectionId;
  const calendarIds = config.calendar?.calendarIds;
  if (!connectionId || !calendarIds?.length) {
    return { ok: false, message: "Calendar not configured on agent" };
  }
  if (config.calendar?.provider !== "google") {
    return { ok: false, message: "Agent calendar provider is not Google" };
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const connection = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, provider: "google" },
  });
  if (!connection || connection.status !== "connected") {
    return { ok: false, message: "Google calendar connection not found or not connected" };
  }

  return {
    ok: true,
    connectionId: connection.id,
    calendarConfig: (connection.config || {}) as CalendarConfig,
    calendarIds: [...calendarIds],
  };
}
