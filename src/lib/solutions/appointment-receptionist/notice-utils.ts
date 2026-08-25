/** Parse wizard min-notice strings ("2 hours", "1 day", "30") into minutes. */
export function parseNoticeMinutes(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();
  if (!s) return 0;
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (s.includes("day")) return Math.round(num * 24 * 60);
  if (s.includes("hour")) return Math.round(num * 60);
  if (s.includes("min")) return Math.round(num);
  // bare number → treat as minutes
  return Math.round(num);
}

/** Parse max-ahead strings ("30 days", "2 weeks", "14") into whole days. */
export function parseDaysAhead(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  }
  const s = String(raw).trim().toLowerCase();
  if (!s) return 0;
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (s.includes("week")) return Math.round(num * 7);
  if (s.includes("month")) return Math.round(num * 30);
  // "30 days" or bare number → days
  return Math.round(num);
}

/** Parse wizard bookingHours like "Mon - Fri, 8:00 AM - 6:00 PM". */
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
