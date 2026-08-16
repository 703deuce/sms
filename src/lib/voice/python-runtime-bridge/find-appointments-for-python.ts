import { listUpcomingVoiceAppointments } from "@/lib/voice/frontdesk/resolve-voice-appointment";
import type { PythonRuntimeError } from "./types";

/** List upcoming appointments for cancel/reschedule disambiguation. */
export async function findAppointmentsForPython(input: {
  workspaceId: string;
  callId: string;
  timezone: string;
  callerE164?: string;
  limit?: number;
}): Promise<
  | {
      ok: true;
      appointments: Array<{
        id: string;
        startsAtIso: string;
        spokenLabel: string;
        fromThisCall: boolean;
      }>;
      linesForModel: string;
    }
  | PythonRuntimeError
> {
  const appointments = await listUpcomingVoiceAppointments({
    workspaceId: input.workspaceId,
    callId: input.callId,
    callerE164: input.callerE164,
    timezone: input.timezone,
    limit: input.limit,
  });

  if (!appointments.length) {
    return {
      ok: true,
      appointments: [],
      linesForModel: "No upcoming appointments found for this caller.",
    };
  }

  const lines = appointments
    .map((row, i) => `${i + 1}. ${row.spokenLabel} (id ${row.id})`)
    .join("\n");

  return {
    ok: true,
    appointments: appointments.map((row) => ({
      id: row.id,
      startsAtIso: row.startsAtIso,
      spokenLabel: row.spokenLabel,
      fromThisCall: row.fromThisCall,
    })),
    linesForModel: lines,
  };
}
