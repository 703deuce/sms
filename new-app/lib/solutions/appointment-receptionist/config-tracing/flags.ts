/** Server: structured receptionist configuration tracing (summary always when trace id present). */
export function isReceptionistConfigTraceEnabled(): boolean {
  const v = process.env.RECEPTIONIST_CONFIG_TRACE?.trim();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** Server: per-field FIELD_DIFF lines (noisy). */
export function isReceptionistConfigTraceVerbose(): boolean {
  const v = process.env.RECEPTIONIST_CONFIG_TRACE_VERBOSE?.trim();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return false;
}

/** Browser: log [RECEPTIONIST][UI_CHANGE] on dirty fields. */
export function isReceptionistUiTraceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env.NEXT_PUBLIC_RECEPTIONIST_CONFIG_TRACE?.trim();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return process.env.NODE_ENV !== "production";
}
