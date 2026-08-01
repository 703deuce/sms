/**
 * Strip secrets / tokens from objects before audit logs or support exports.
 */

const SENSITIVE_KEY =
  /^(access_?token|refresh_?token|client_secret|authorization|password|secret|api_?key|id_token)$/i;

export function redactSensitive<T>(value: T, depth = 0): T {
  if (value == null || depth > 8) return value;
  if (typeof value === "string") {
    if (value.startsWith("enc:v1:")) return "[encrypted]" as T;
    if (value.length > 40 && /^[A-Za-z0-9._\-]+$/.test(value) && /token|bearer/i.test(value)) {
      return "[redacted]" as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, depth + 1)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactSensitive(v, depth + 1);
      }
    }
    return out as T;
  }
  return value;
}
