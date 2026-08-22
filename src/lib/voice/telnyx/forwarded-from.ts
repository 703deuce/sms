/**
 * Resolve original forwarder (business line) from Telnyx call.initiated payload.
 * AT&T often sends Diversion in sip_headers while forwarded_from is empty.
 */
export function parseTelnyxForwardedFrom(
  eventPayload: Record<string, unknown>,
): string | undefined {
  const direct = String(eventPayload.forwarded_from ?? "").trim();
  if (direct) return direct;

  const headers = eventPayload.sip_headers;
  if (!Array.isArray(headers)) return undefined;

  for (const raw of headers) {
    if (!raw || typeof raw !== "object") continue;
    const header = raw as { name?: string; value?: string };
    if (String(header.name || "").toLowerCase() !== "diversion") continue;
    const value = String(header.value || "");
    const sipMatch = value.match(/sip:([^@>;]+)/i);
    const telMatch = value.match(/tel:([^;>]+)/i);
    const candidate = (sipMatch?.[1] || telMatch?.[1] || "").trim();
    if (candidate) return candidate;
  }

  return undefined;
}
