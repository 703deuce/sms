import type { AvailableSlot } from "../calendly-calendar";

export function formatSlotSpokenLabel(slot: AvailableSlot, timezone: string): string {
  const weekday = slot.startTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
  const time = slot.startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${weekday} at ${time}`;
}
