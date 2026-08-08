import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  getStoredTelnyxFqdnConnectionId,
  getLiveKitSipHost,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
} from "../config";

type TelnyxRecord = Record<string, unknown>;

function asRecord(v: unknown): TelnyxRecord | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as TelnyxRecord) : null;
}

export async function findFqdnConnectionByName(
  name: string,
): Promise<TelnyxRecord | null> {
  const res = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdn_connections", {
    query: { "page[size]": 100 },
  });
  const rows = res.data || [];
  return rows.find((r) => String(r.connection_name || "") === name) || null;
}

export async function ensureTelnyxLiveKitFqdnConnection(): Promise<{
  connectionId: string;
  fqdnId: string;
  created: boolean;
  actions: string[];
}> {
  const actions: string[] = [];
  const sipHost = getLiveKitSipHost();
  if (!sipHost) {
    throw new Error("LIVEKIT_SIP_HOST is required to create Telnyx FQDN connection");
  }

  const storedId = getStoredTelnyxFqdnConnectionId();
  if (storedId) {
    try {
      const res = await telnyxRequest<{ data?: TelnyxRecord }>(
        `/fqdn_connections/${encodeURIComponent(storedId)}`,
      );
      const row = asRecord(res.data);
      if (row?.id) {
        if (row.active === false) {
          await telnyxRequest(`/fqdn_connections/${encodeURIComponent(storedId)}`, {
            method: "PATCH",
            body: { active: true },
          });
          actions.push("enabled_stored_fqdn_connection");
        }
        const fqdnId = await ensureFqdnRecord(String(row.id), sipHost, actions);
        return {
          connectionId: String(row.id),
          fqdnId,
          created: false,
          actions: [...actions, "reuse_env_fqdn_connection_id"],
        };
      }
    } catch {
      actions.push("env_fqdn_connection_id_stale");
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
  } else if (conn.active === false) {
    await telnyxRequest(`/fqdn_connections/${encodeURIComponent(String(conn.id))}`, {
      method: "PATCH",
      body: { active: true },
    });
    actions.push("enabled_existing_fqdn_connection");
  }

  const connectionId = String(conn?.id || "");
  if (!connectionId) throw new Error("Telnyx FQDN connection missing id");

  const fqdnId = await ensureFqdnRecord(connectionId, sipHost, actions);
  return {
    connectionId,
    fqdnId,
    created: actions.includes("created_fqdn_connection"),
    actions,
  };
}

async function ensureFqdnRecord(
  connectionId: string,
  sipHost: string,
  actions: string[],
): Promise<string> {
  const listed = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdns", {
    query: { "filter[connection_id]": connectionId },
  });
  const existing = (listed.data || []).find(
    (r) => String(r.fqdn || "").toLowerCase() === sipHost.toLowerCase(),
  );
  if (existing?.id) return String(existing.id);

  const created = await telnyxRequest<{ data?: TelnyxRecord }>("/fqdns", {
    method: "POST",
    body: {
      connection_id: connectionId,
      fqdn: sipHost,
      port: 5060,
      dns_record_type: "a",
    },
  });
  actions.push("created_fqdn_record");
  return String(created.data?.id || "");
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
