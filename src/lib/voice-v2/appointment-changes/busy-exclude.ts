import type { BusyInterval } from "@/lib/voice/calendar/providers";

/** Remove busy time for the appointment being rescheduled so its slot stays bookable. */
export function subtractBusyInterval(
  busy: BusyInterval[],
  exclude: { start: Date; end: Date },
): BusyInterval[] {
  const out: BusyInterval[] = [];
  for (const b of busy) {
    if (exclude.start < b.end && exclude.end > b.start) {
      if (b.start < exclude.start) {
        out.push({ start: b.start, end: exclude.start });
      }
      if (b.end > exclude.end) {
        out.push({ start: exclude.end, end: b.end });
      }
    } else {
      out.push(b);
    }
  }
  return out;
}
