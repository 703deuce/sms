import "server-only";

import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

export type TelnyxMessageStatusLookup = {
  status: string;
  providerStatus: string;
  errorCode?: string | null;
  errorDetail?: string | null;
};

/** Fetch current delivery status for a Telnyx message id (v2 API). */
export async function lookupTelnyxMessageStatus(
  providerMessageId: string,
): Promise<TelnyxMessageStatusLookup | null> {
  const apiKey = getTelnyxApiKey();
  if (!apiKey || !providerMessageId.trim()) return null;

  const res = await fetch(`https://api.telnyx.com/v2/messages/${providerMessageId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { data?: Record<string, unknown> };
  const data = json.data || {};
  const toArr = Array.isArray(data.to) ? data.to : [];
  const providerStatus = String(
    (toArr[0] as { status?: string } | undefined)?.status || data.status || "unknown",
  );
  const errors = Array.isArray(data.errors) ? data.errors : [];
  const status = providerStatus.toLowerCase();
  return {
    status: status === "delivery_failed" ? "failed" : status,
    providerStatus,
    errorCode: errors[0]?.code != null ? String(errors[0].code) : null,
    errorDetail: errors[0]?.detail != null ? String(errors[0].detail) : null,
  };
}
