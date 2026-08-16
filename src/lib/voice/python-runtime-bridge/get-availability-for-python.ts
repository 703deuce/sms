import { CalendlyCalendar } from "../../../../voice-runtime/src/frontdesk/calendly-calendar";
import type { AvailabilitySlot, PythonRuntimeError } from "./types";

/** Lightweight Calendly availability — no handlers.ts / LiveKit imports. */
export async function getAvailabilityForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  timezone: string;
  eventTypeUri?: string | null;
  daysAhead?: number;
}): Promise<{ ok: true; slots: AvailabilitySlot[]; linesForModel: string } | PythonRuntimeError> {
  const cal = CalendlyCalendar.create({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    timezone: input.timezone,
    eventTypeUri: input.eventTypeUri,
  });

  try {
    const slots = await cal.listAvailableSlots({ daysAhead: input.daysAhead ?? 14 });
    const lines = cal.formatSlotsForModel(slots);
    const formatted: AvailabilitySlot[] = slots.map((slot) => ({
      slotId: slot.slotId,
      startTimeIso: slot.startTime.toISOString(),
      durationMin: slot.durationMin,
      spokenLabel: cal.formatSlotsForModel([slot]).split("\n")[0] || slot.slotId,
    }));
    return { ok: true, slots: formatted, linesForModel: lines };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "AVAILABILITY_FAILED",
    };
  }
}
