import "server-only";

import { telnyxRequest } from "@/lib/server/telnyx/client";
import {
  getStoredTelnyxFqdnConnectionId,
  resolveLiveKitSipHost,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
} from "@/lib/server/telephony/config";

type TelnyxRecord = Record<string, unknown>;

function asRecord(v: unknown): TelnyxRecord | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as TelnyxRecord) : null;
}

function normalizeE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (!digits) return e164;
  if (e164.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

async function findFqdnConnectionByName(name: string): Promise<TelnyxRecord | null> {
  const res = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdn_connections", {
    query: { "page[size]": 100 },
  });
  const rows = res.data || [];
  return rows.find((r) => String(r.connection_name || "") === name) || null;
}

async function ensureFqdnRecord(
  connectionId: string,
  sipHost: string,
  actions: string[],
): Promise<string> {
  const listed = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdns", {
    query: { "filter[connection_id]": connectionId },
  });
  const rows = listed.data || [];
  let target = rows.find((r) => String(r.fqdn || "").toLowerCase() === sipHost.toLowerCase());

  if (!target?.id) {
    const created = await telnyxRequest<{ data?: TelnyxRecord }>("/fqdns", {
      method: "POST",
      body: {
        connection_id: connectionId,
        fqdn: sipHost,
        port: 5060,
        dns_record_type: "a",
      },
    });
    target = asRecord(created.data) || undefined;
    actions.push("created_fqdn_record");
  }

  const fqdnId = String(target?.id || "");
  if (!fqdnId) throw new Error(`Telnyx FQDN record missing for ${sipHost}`);

  const conn = await telnyxRequest<{ data?: TelnyxRecord }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  const inbound = (conn.data?.inbound as TelnyxRecord | undefined) || {};
  const primaryId = String(inbound.default_primary_fqdn_id || "");
  const dnisFormat = String(inbound.dnis_number_format || "");
  if (primaryId !== fqdnId || dnisFormat.toLowerCase() !== "+e164") {
    await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
      method: "PATCH",
      body: {
        inbound: {
          default_primary_fqdn_id: fqdnId,
          default_secondary_fqdn_id: null,
          default_tertiary_fqdn_id: null,
          dnis_number_format: "+e164",
        },
      },
    });
    actions.push("patched_fqdn_connection_inbound");
  }

  return fqdnId;
}

export async function ensureTelnyxLiveKitFqdnConnection(): Promise<{
  connectionId: string;
  fqdnId: string;
  actions: string[];
}> {
  const actions: string[] = [];
  const { host: sipHost } = resolveLiveKitSipHost();
  if (!sipHost) {
    throw new Error(
      "LiveKit SIP host not configured — set LIVEKIT_SIP_HOST, LIVEKIT_SIP_URI, or LIVEKIT_URL",
    );
  }

  const storedId = getStoredTelnyxFqdnConnectionId();
  if (storedId) {
    try {
      const res = await telnyxRequest<{ data?: TelnyxRecord }>(
        `/fqdn_connections/${encodeURIComponent(storedId)}`,
      );
      const row = asRecord(res.data);
      if (row?.id) {
        const fqdnId = await ensureFqdnRecord(String(row.id), sipHost, actions);
        return { connectionId: String(row.id), fqdnId, actions: [...actions, "reuse_env_fqdn"] };
      }
    } catch {
      actions.push("env_fqdn_stale");
    }
  }

  let conn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  if (!conn) {
    const created = await telnyxRequest<{ data?: TelnyxRecord }>("/fqdn_connections", {
      method: "POST",
      body: {
        active: true,
        anchorsite_override: "Latency",
        connection_name: TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
        inbound: {
          ani_number_format: "+E.164",
          dnis_number_format: "+e164",
        },
        transport_protocol: "TCP",
      },
    });
    conn = asRecord(created.data);
    actions.push("created_fqdn_connection");
  }

  const connectionId = String(conn?.id || "");
  if (!connectionId) throw new Error("Telnyx FQDN connection missing id");

  const fqdnId = await ensureFqdnRecord(connectionId, sipHost, actions);
  return { connectionId, fqdnId, actions };
}

export async function resolveTelnyxPhoneNumberId(input: {
  e164: string;
  existingId?: string | null;
}): Promise<string> {
  if (input.existingId?.trim()) return input.existingId.trim();
  const e164 = normalizeE164(input.e164);
  const res = await telnyxRequest<{ data?: TelnyxRecord[] }>("/phone_numbers", {
    query: { "filter[phone_number]": e164 },
  });
  const row = (res.data || [])[0];
  const id = String(row?.id || "");
  if (!id) throw new Error(`Telnyx number ${e164} not found`);
  return id;
}

export async function routeTelnyxNumberToConnection(input: {
  e164: string;
  providerNumberId?: string | null;
  connectionId: string;
}): Promise<{ providerNumberId: string; previousConnectionId?: string }> {
  const providerNumberId = await resolveTelnyxPhoneNumberId({
    e164: input.e164,
    existingId: input.providerNumberId,
  });

  const before = await telnyxRequest<{ data?: TelnyxRecord }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const previousConnectionId = String(
    (asRecord(before.data) || asRecord(before) || {}).connection_id || "",
  );

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: input.connectionId },
  });

  return {
    providerNumberId,
    previousConnectionId: previousConnectionId || undefined,
  };
}
