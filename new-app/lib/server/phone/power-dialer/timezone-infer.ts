/** Approximate US area-code → IANA timezone (M28 fallback only). */
const US_AREA_TZ: Record<string, string> = {
  "212": "America/New_York",
  "213": "America/Los_Angeles",
  "312": "America/Chicago",
  "415": "America/Los_Angeles",
  "512": "America/Chicago",
  "602": "America/Phoenix",
  "713": "America/Chicago",
  "305": "America/New_York",
};

export function inferTimezoneFromAreaCode(e164: string): string | null {
  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith("1") || digits.length < 11) return null;
  const area = digits.slice(1, 4);
  return US_AREA_TZ[area] || null;
}
