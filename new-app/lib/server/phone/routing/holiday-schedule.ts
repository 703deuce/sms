/** Pure helpers for holiday exception JSON on answering policies. */

export type HolidayDestinationRef = {
  kind: "external_phone" | "workspace_number";
  e164PhoneNumber?: string;
  phoneNumberId?: string;
};

export type HolidayException = {
  /** ISO date YYYY-MM-DD in workspace timezone context */
  date: string;
  mode: "closed" | "forward" | "voicemail" | "auto_attendant";
  destinationId?: string;
  destinationRef?: HolidayDestinationRef;
  menuId?: string;
  label?: string;
};

export function parseHolidayExceptions(raw: unknown): HolidayException[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const date = String(o.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const mode = String(o.mode || "closed");
      return {
        date,
        mode,
        destinationId: typeof o.destinationId === "string" ? o.destinationId : undefined,
        destinationRef:
          o.destinationRef && typeof o.destinationRef === "object"
            ? (o.destinationRef as HolidayDestinationRef)
            : undefined,
        menuId: typeof o.menuId === "string" ? o.menuId : undefined,
        label: typeof o.label === "string" ? o.label : undefined,
      } satisfies HolidayException;
    })
    .filter(Boolean) as HolidayException[];
}

export function holidayActiveToday(
  exceptions: HolidayException[],
  timezone: string,
): HolidayException | null {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = formatter.format(new Date());
  return exceptions.find((h) => h.date === today) ?? null;
}
