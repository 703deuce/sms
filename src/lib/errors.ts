/**
 * Turn unknown thrown/API values into a human-readable string.
 * Prevents UI showing "[object Object]" when APIs return error objects.
 */
export function toErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err == null) return fallback;
  if (typeof err === "string") {
    const s = err.trim();
    return s && s !== "[object Object]" ? s : fallback;
  }
  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (msg && msg !== "[object Object]") return msg;
    // Some libs put details on non-standard fields.
    const anyErr = err as Error & { detail?: unknown; details?: unknown; code?: unknown };
    const nested = toErrorMessage(anyErr.detail ?? anyErr.details, "");
    if (nested) return nested;
    if (anyErr.code != null) return String(anyErr.code);
    return fallback;
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["error", "message", "detail", "details", "title", "reason"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim() && v !== "[object Object]") return v.trim();
      if (v && typeof v === "object") {
        const nested = toErrorMessage(v, "");
        if (nested) return nested;
      }
    }
    if (Array.isArray(o.errors) && o.errors.length) {
      const parts = o.errors
        .map((e) => toErrorMessage(e, ""))
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}" && json !== "null") {
        return json.length > 400 ? `${json.slice(0, 400)}…` : json;
      }
    } catch {
      // ignore
    }
  }
  return fallback;
}
