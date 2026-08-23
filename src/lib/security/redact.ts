const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|api[_-]?key|refresh[_-]?token|service[_-]?role|cookie|set-cookie/i;

/** Deep-clone-ish redact for structured logs — never log secrets or large PII blobs. */
export function redactForLogs(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 120)}…[truncated ${value.length} chars]`;
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactForLogs(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactForLogs(v, depth + 1);
    }
  }
  return out;
}
