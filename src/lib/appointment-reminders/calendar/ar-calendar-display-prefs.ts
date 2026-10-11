export type ArCalendarDisplayHoursPreset = "business" | "full" | "extended";

export type ArCalendarSlotDensity = "compact" | "comfortable" | "spacious";

export type ArCalendarDisplayPrefs = {
  hoursPreset: ArCalendarDisplayHoursPreset;
  customStartHour: number;
  customEndHour: number;
  slotDensity: ArCalendarSlotDensity;
};

const STORAGE_KEY = "transovo.ar.calendar.displayPrefs.v1";

export const AR_CALENDAR_HOUR_PRESETS: Record<
  ArCalendarDisplayHoursPreset,
  { startHour: number; endHour: number; label: string }
> = {
  business: { startHour: 8, endHour: 18, label: "Business hours (8 AM – 6 PM)" },
  full: { startHour: 6, endHour: 21, label: "Full day (6 AM – 9 PM)" },
  extended: { startHour: 5, endHour: 22, label: "Extended (5 AM – 10 PM)" },
};

export const AR_CALENDAR_SLOT_DENSITY_PX: Record<ArCalendarSlotDensity, number> = {
  compact: 48,
  comfortable: 56,
  spacious: 64,
};

export const DEFAULT_AR_CALENDAR_DISPLAY_PREFS: ArCalendarDisplayPrefs = {
  hoursPreset: "full",
  customStartHour: 8,
  customEndHour: 18,
  slotDensity: "comfortable",
};

export function resolveDisplayGrid(prefs: ArCalendarDisplayPrefs) {
  const preset = AR_CALENDAR_HOUR_PRESETS[prefs.hoursPreset];
  const startHour = preset.startHour;
  const endHour = preset.endHour;
  const hourPx = AR_CALENDAR_SLOT_DENSITY_PX[prefs.slotDensity];
  return { startHour, endHour, hourPx };
}

export function loadArCalendarDisplayPrefs(): ArCalendarDisplayPrefs {
  if (typeof window === "undefined") return DEFAULT_AR_CALENDAR_DISPLAY_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AR_CALENDAR_DISPLAY_PREFS;
    const parsed = JSON.parse(raw) as Partial<ArCalendarDisplayPrefs>;
    return {
      ...DEFAULT_AR_CALENDAR_DISPLAY_PREFS,
      ...parsed,
    };
  } catch {
    return DEFAULT_AR_CALENDAR_DISPLAY_PREFS;
  }
}

export function saveArCalendarDisplayPrefs(prefs: ArCalendarDisplayPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
