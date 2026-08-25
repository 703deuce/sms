/**
 * Resolve original forwarder (business line) from Telnyx call.initiated payload.
 * AT&T often sends Diversion in sip_headers while forwarded_from is empty.
 * TeXML may send ForwardedFrom as sip:+1...@carrier.net.
 */
export function extractForwardedNumber(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const sipMatch = value.match(/sip:([^@>;]+)/i);
  const telMatch = value.match(/tel:([^;>]+)/i);
  const candidate = (sipMatch?.[1] || telMatch?.[1] || value).trim();
  return candidate || undefined;
}

export function normalizeForwardedFromE164(raw: string | null | undefined): string | undefined {
  const candidate = extractForwardedNumber(String(raw || ""));
  if (!candidate) return undefined;
  const digits = candidate.replace(/\D/g, "");
  if (!digits) return undefined;
  if (candidate.startsWith("+")) return candidate;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function parseTelnyxForwardedFrom(
  eventPayload: Record<string, unknown>,
): string | undefined {
  const direct = normalizeForwardedFromE164(
    String(eventPayload.forwarded_from ?? eventPayload.ForwardedFrom ?? ""),
  );
  if (direct) return direct;

  const headers = eventPayload.sip_headers;
  if (!Array.isArray(headers)) return undefined;

  for (const raw of headers) {
    if (!raw || typeof raw !== "object") continue;
    const header = raw as { name?: string; value?: string };
    if (String(header.name || "").toLowerCase() !== "diversion") continue;
    const normalized = normalizeForwardedFromE164(String(header.value || ""));
    if (normalized) return normalized;
  }

  return undefined;
}

export function hasDiversionHeaderInPayload(
  eventPayload: Record<string, unknown>,
): boolean {
  const headers = eventPayload.sip_headers;
  if (!Array.isArray(headers)) return false;
  return headers.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    return String((raw as { name?: string }).name || "").toLowerCase() === "diversion";
  });
}
