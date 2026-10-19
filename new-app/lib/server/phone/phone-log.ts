/** Structured logs for Phone / Telnyx — grep container logs for `"phoneLog":true`. */
export function phoneServerLog(
  area: string,
  event: string,
  fields?: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({
      phoneLog: true,
      area,
      event,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
}

export function maskE164(e164: string | null | undefined): string | null {
  if (!e164?.trim()) return null;
  const d = e164.replace(/\D/g, "");
  if (d.length <= 4) return e164;
  return `***${d.slice(-4)}`;
}
