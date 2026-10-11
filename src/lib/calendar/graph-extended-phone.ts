import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/** Comma-separated extended property keys (Graph private / Google private) for customer phone. */
export function graphExtendedPhonePropertyKeys(): string[] {
  const raw = process.env.AR_GRAPH_CUSTOMER_PHONE_PROPERTY_KEYS || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function extractPhoneFromExtendedProperties(
  privateProps: Record<string, string> | undefined | null,
  connectionPropertyKeys?: string[] | null,
): string | null {
  if (!privateProps) return null;
  const fromConnection = (connectionPropertyKeys || []).map((k) => k.trim()).filter(Boolean);
  const keys = fromConnection.length ? fromConnection : graphExtendedPhonePropertyKeys();
  const candidates = keys.length
    ? keys.map((k) => privateProps[k]).filter(Boolean)
    : Object.values(privateProps);
  for (const raw of candidates) {
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    try {
      const e164 = normalizeE164(trimmed);
      if (e164) return e164;
    } catch {
      // try next
    }
  }
  return null;
}
