import "server-only";

import { telnyxRequest } from "@/lib/server/telnyx/client";
import { resolveTelnyxPhoneNumberId } from "@/lib/server/telephony/telnyx-livekit-fqdn";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export async function readLiveTelnyxConnectionId(input: {
  e164: string;
  providerNumberId?: string | null;
}): Promise<{ providerNumberId: string; connectionId: string | null }> {
  const providerNumberId = await resolveTelnyxPhoneNumberId({
    e164: input.e164,
    existingId: input.providerNumberId,
  });
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const row = asRecord(res.data) || asRecord(res) || {};
  const connectionId = String(row.connection_id || "") || null;
  return { providerNumberId, connectionId };
}

export async function patchTelnyxNumberConnection(input: {
  providerNumberId: string;
  connectionId: string;
}): Promise<void> {
  await telnyxRequest(`/phone_numbers/${encodeURIComponent(input.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: input.connectionId },
  });
}

export async function verifyTelnyxNumberConnection(input: {
  providerNumberId: string;
  expectedConnectionId: string;
}): Promise<{ ok: boolean; liveConnectionId: string | null }> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(input.providerNumberId)}`,
  );
  const row = asRecord(res.data) || asRecord(res) || {};
  const live = String(row.connection_id || "") || null;
  return { ok: live === input.expectedConnectionId, liveConnectionId: live };
}
