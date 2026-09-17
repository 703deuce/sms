export function parseBookingHours(raw: string | null | undefined): {
  startHour: number;
  endHour: number;
  weekdaysOnly: boolean;
} | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const weekdaysOnly = /mon\s*[-–to]+\s*fri/i.test(s) || /weekday/i.test(s);
  const timeMatch = s.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!timeMatch) return null;

  const toHour = (hStr: string, mStr: string | undefined, mer: string | undefined) => {
    let h = Number(hStr);
    const m = Number(mStr || 0);
    const merL = (mer || "").toLowerCase();
    if (merL === "pm" && h < 12) h += 12;
    if (merL === "am" && h === 12) h = 0;
    return h + (m >= 30 ? 0.5 : 0);
  };

  // If only one side has am/pm, reuse it for the other.
  const startMer = timeMatch[3] || timeMatch[6];
  const endMer = timeMatch[6] || timeMatch[3];
  const startHour = Math.floor(toHour(timeMatch[1], timeMatch[2], timeMatch[3] || startMer));
  const endHour = Math.ceil(toHour(timeMatch[4], timeMatch[5], endMer));
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
    return null;
  }
  return {
    startHour: Math.max(0, Math.min(23, startHour)),
    endHour: Math.max(1, Math.min(24, endHour)),
    weekdaysOnly,
  };
}
