/** PII / secret redaction for voice diagnostics and logs. */

const SENSITIVE_KEY =
  /secret|token|password|authorization|api[_-]?key|ssn|dob|credit|cvv|email|phone/i;

export function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, "[email]")
      .replace(/\b\+?\d[\d\s().-]{7,}\b/g, "[phone]")
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redactValue(v);
    }
    return out;
  }
  return value;
}

/** Block prompt-injection style unrestricted destinations in tool args. */
export function sanitizeToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== "string") continue;
    if (/^(javascript:|data:|file:)/i.test(v)) {
      delete out[k];
      continue;
    }
    if (/url|href|endpoint/i.test(k) && !/^https?:\/\//i.test(v)) {
      delete out[k];
    }
    // Strip SQL-ish injections from free text
    if (/(;\s*drop\s+table|union\s+select|--\s*$)/i.test(v)) {
      out[k] = v.replace(/(;\s*drop\s+table|union\s+select|--\s*$)/gi, "[blocked]");
    }
  }
  return out;
}

export function assertSafeTransferDestination(dest: string) {
  const d = dest.trim();
  if (!d) throw new Error("Empty transfer destination");
  if (/^(javascript:|data:|file:)/i.test(d)) {
    throw new Error("Prohibited transfer destination scheme");
  }
  // Allow E.164 or sip:
  if (!(d.startsWith("+") || d.toLowerCase().startsWith("sip:") || /^\d{7,15}$/.test(d))) {
    throw new Error("Transfer destination must be E.164 or sip: URI");
  }
  return d;
}
