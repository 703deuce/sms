/** Central MCTB scheduling daypart semantics (search windows only — not availability). */

export type DaypartWindow = { startHour: number; endHour: number };

export const MCTB_DAYPART_WINDOWS: Record<string, DaypartWindow> = {
  morning: { startHour: 8, endHour: 12 },
  afternoon: { startHour: 12, endHour: 17 },
  evening: { startHour: 17, endHour: 20 },
  lunch: { startHour: 11, endHour: 14 },
  before_lunch: { startHour: 8, endHour: 12 },
  after_lunch: { startHour: 13, endHour: 17 },
};

export function resolveDaypart(label: string): DaypartWindow | null {
  const key = label.toLowerCase().replace(/\s+/g, "_");
  return MCTB_DAYPART_WINDOWS[key] ?? null;
}
