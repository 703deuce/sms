import { DEFAULT_MCTB_DISPLAY_TIMEZONE } from "@/lib/mctb/display-datetime";

/** US IANA zones supported for MCTB display, pause, and scheduling copy. */
export const MCTB_US_TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona (no daylight saving)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

const ALLOWED = new Set(MCTB_US_TIMEZONE_OPTIONS.map((o) => o.value));

export function resolveMctbUsTimezoneChoice(input?: string | null): string {
  const tz = input?.trim();
  if (tz && ALLOWED.has(tz)) return tz;
  return DEFAULT_MCTB_DISPLAY_TIMEZONE;
}

/** Best-effort default from browser IANA zone; falls back to Eastern. */
export function guessUsTimezoneForOnboarding(): string {
  try {
    const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolveMctbUsTimezoneChoice(iana);
  } catch {
    return DEFAULT_MCTB_DISPLAY_TIMEZONE;
  }
}
