import "server-only";

import type { VoiceV3AgentConfig } from "../../config/agent-config";
import type { CalendarConfig } from "@/lib/voice/calendar/providers";

export type ResolvedVoiceV3MicrosoftCalendar =
  | {
      ok: true;
      connectionId: string;
      calendarConfig: CalendarConfig;
      calendarIds: string[];
    }
  | { ok: false; message: string };

/**
 * Same Microsoft connection + calendar ids used by certified FIND/BOOK.
 * Appointment management must not resolve a different connection.
 */
export async function resolveVoiceV3MicrosoftCalendar(
  config: VoiceV3AgentConfig,
): Promise<ResolvedVoiceV3MicrosoftCalendar> {
  const connectionId = config.calendar?.connectionId;
  const calendarIds = config.calendar?.calendarIds;
  if (!connectionId || !calendarIds?.length) {
    return { ok: false, message: "Calendar not configured on agent" };
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const connection = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, provider: "microsoft" },
  });
  if (!connection || connection.status !== "connected") {
    return { ok: false, message: "Microsoft calendar connection not found or not connected" };
  }

  return {
    ok: true,
    connectionId: connection.id,
    calendarConfig: (connection.config || {}) as CalendarConfig,
    calendarIds: [...calendarIds],
  };
}
