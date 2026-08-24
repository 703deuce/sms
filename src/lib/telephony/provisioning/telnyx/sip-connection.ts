import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { ensureTelnyxFqdnConnectionForBackend } from "@/lib/voice/media-backend/telnyx-failover";

type TelnyxRecord = Record<string, unknown>;

export async function findFqdnConnectionByName(
  name: string,
): Promise<TelnyxRecord | null> {
  const res = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdn_connections", {
    query: { "page[size]": 100 },
  });
  const rows = res.data || [];
  return rows.find((r) => String(r.connection_name || "") === name) || null;
}

/** Cloud LiveKit SIP FQDN connection (backward-compatible wrapper). */
export async function ensureTelnyxLiveKitFqdnConnection(): Promise<{
  connectionId: string;
  fqdnId: string;
  created: boolean;
  actions: string[];
}> {
  const result = await ensureTelnyxFqdnConnectionForBackend("livekit_cloud");
  return {
    connectionId: result.connectionId,
    fqdnId: result.fqdnId,
    created: result.created,
    actions: result.actions,
  };
}

export async function routeTelnyxNumberToConnection(input: {
  e164: string;
  providerNumberId?: string | null;
  connectionId: string;
}): Promise<{ providerNumberId: string; previousConnectionId?: string }> {
  const e164 = normalizeE164(input.e164);
  let providerNumberId = input.providerNumberId?.trim() || "";

  if (!providerNumberId) {
    const listed = await telnyxRequest<{ data?: TelnyxRecord[] }>("/phone_numbers", {
      query: { "filter[phone_number]": e164 },
    });
    providerNumberId = String(listed.data?.[0]?.id || "");
  }
  if (!providerNumberId) {
    throw new Error(`Telnyx number ${e164} not found`);
  }

  const before = await telnyxRequest<{ data?: TelnyxRecord }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const previousConnectionId = before.data?.connection_id
    ? String(before.data.connection_id)
    : undefined;

  if (previousConnectionId === input.connectionId) {
    return { providerNumberId, previousConnectionId };
  }

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: input.connectionId },
  });

  return { providerNumberId, previousConnectionId };
}
