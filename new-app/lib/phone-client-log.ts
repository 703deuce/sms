/** Browser console logs for Phone / WebRTC — filter DevTools by `[phone]`. */
export function phoneClientLog(
  area: string,
  event: string,
  fields?: Record<string, unknown>,
) {
  if (typeof console === "undefined") return;
  console.log(`[phone] ${area} · ${event}`, fields ?? {});
}
