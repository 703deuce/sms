export function matchSlotFromInput(
  userInput: string,
  slots: string[],
  timezone = "America/New_York",
): string | null {
  const trimmed = userInput.trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 7) return null;

  const lower = trimmed.toLowerCase();

  if (slots.length > 0) {
    if (/\b(first|1st|earlier|sooner)\b/.test(lower)) return slots[0]!;
    if (/\b(second|2nd)\b/.test(lower) && slots.length > 1) return slots[1]!;
    if (/\b(third|3rd)\b/.test(lower) && slots.length > 2) return slots[2]!;
    if (/\b(last|later|latest)\b/.test(lower)) return slots[slots.length - 1]!;
  }

  const exact = slots.find((s) => s === trimmed || trimmed.includes(s));
  if (exact) return exact;

  for (const slot of slots) {
    const d = new Date(slot);
    if (Number.isNaN(d.getTime())) continue;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(d);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toLowerCase();
    if (!hour || !dayPeriod) continue;
    const hourNum = Number(hour);
    const patterns = [
      `${hour}:${minute}`,
      `${hour}:${minute}${dayPeriod}`,
      `${hour}:${minute} ${dayPeriod}`,
      `${hourNum}${dayPeriod}`,
      `${hourNum} ${dayPeriod}`,
      `${hourNum}`,
    ];
    if (patterns.some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower))) {
      return slot;
    }
  }
  return null;
}
