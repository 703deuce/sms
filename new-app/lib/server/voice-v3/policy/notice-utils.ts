/** Parse booking notice / horizon strings from new-app appointment type fields. */
export function parseNoticeMinutes(value: string | undefined | null): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseDaysAhead(value: string | undefined | null): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
