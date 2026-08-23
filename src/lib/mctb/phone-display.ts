/** Format E.164 for MCTB setup UI labels (not the shared Try It demo line name). */
export function formatMctbPhoneLabel(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}
