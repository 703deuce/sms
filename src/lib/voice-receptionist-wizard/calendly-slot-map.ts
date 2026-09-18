import { slotIdFor } from "@/lib/mctb/ai-booking/slot-id";
import type { VoiceV2Slot } from "./types";

export type CalendlyAvailabilitySlot = {
  startTime: string;
  status?: string;
};

export function mapCalendlyAvailabilityToVoiceV2Slots(input: {
  slots: CalendlyAvailabilitySlot[];
  timezone: string;
  durationMinutes: number;
  eventTypeUri: string;
  maxSlots: number;
}): VoiceV2Slot[] {
  const max = Math.max(1, Math.min(12, input.maxSlots));
  const open = input.slots.filter(
    (s) => /available/i.test(String(s.status || "available")) || !s.status,
  );
  const out: VoiceV2Slot[] = [];
  for (const s of open) {
    const startUtc = String(s.startTime || "").trim();
    if (!startUtc) continue;
    const start = new Date(startUtc);
    if (Number.isNaN(start.getTime())) continue;
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    const endUtc = end.toISOString();
    const spoken = new Intl.DateTimeFormat("en-US", {
      timeZone: input.timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(start);
    const slotId = slotIdFor(startUtc, endUtc, "calendly");
    out.push({
      slot_id: slotId,
      label: spoken,
      spoken_label: spoken,
      start_utc: startUtc,
      end_utc: endUtc,
      provider: "calendly",
      provider_metadata: {
        event_type_uri: input.eventTypeUri,
        calendly_start_time: startUtc,
      },
    });
    if (out.length >= max) break;
  }
  return out;
}
