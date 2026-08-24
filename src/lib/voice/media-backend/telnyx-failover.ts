import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  getAuthoritativeLiveKitSipHostForBackend,
  getLiveKitBackendConfig,
  getTelnyxFqdnConnectionNameForBackend,
  getTelnyxStoredFqdnConnectionIdForBackend,
  isTelnyxLiveKitFailoverEnabled,
} from "./config";
import type { MediaBackend } from "./types";

type TelnyxRecord = Record<string, unknown>;

function asRecord(v: unknown): TelnyxRecord | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as TelnyxRecord) : null;
}

async function findFqdnConnectionByName(name: string): Promise<TelnyxRecord | null> {
  const res = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdn_connections", {
    query: { "page[size]": 100 },
  });
  return res.data?.find((r) => String(r.connection_name || "") === name) || null;
}

async function listFqdns(connectionId: string): Promise<TelnyxRecord[]> {
  const listed = await telnyxRequest<{ data?: TelnyxRecord[] }>("/fqdns", {
    query: { "filter[connection_id]": connectionId },
  });
  return listed.data || [];
}

async function ensureFqdnOnConnection(input: {
  connectionId: string;
  sipHost: string;
  actions: string[];
}): Promise<string> {
  const rows = await listFqdns(input.connectionId);
  let target = rows.find(
    (r) => String(r.fqdn || "").toLowerCase() === input.sipHost.toLowerCase(),
  );

  if (!target?.id) {
    const created = await telnyxRequest<{ data?: TelnyxRecord }>("/fqdns", {
      method: "POST",
      body: {
        connection_id: input.connectionId,
        fqdn: input.sipHost,
        port: 5060,
        dns_record_type: "a",
      },
    });
    target = asRecord(created.data) || undefined;
    input.actions.push(`created_fqdn_${input.sipHost}`);
  }

  const fqdnId = String(target?.id || "");
  if (!fqdnId) throw new Error(`Telnyx FQDN record missing for ${input.sipHost}`);
  return fqdnId;
}

/**
 * Ensure a Telnyx FQDN connection routes to the given LiveKit media backend SIP host.
 */
export async function ensureTelnyxFqdnConnectionForBackend(
  backend: MediaBackend,
): Promise<{
  connectionId: string;
  fqdnId: string;
  sipHost: string;
  created: boolean;
  actions: string[];
}> {
  const actions: string[] = [];
  const { host: sipHost } = getAuthoritativeLiveKitSipHostForBackend(backend);
  const connectionName = getTelnyxFqdnConnectionNameForBackend(backend);
  const storedId = getTelnyxStoredFqdnConnectionIdForBackend(backend);

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
        const fqdnId = await ensureFqdnOnConnection({
          connectionId: String(row.id),
          sipHost,
          actions,
        });
        return {
          connectionId: String(row.id),
          fqdnId,
          sipHost,
          created: false,
          actions: [...actions, "reuse_env_fqdn_connection_id"],
        };
      }
    } catch {
      actions.push("env_fqdn_connection_id_stale");
    }
  }

  let conn = await findFqdnConnectionByName(connectionName);
  if (!conn) {
    const created = await telnyxRequest<{ data?: TelnyxRecord }>("/fqdn_connections", {
      method: "POST",
      body: {
        active: true,
        anchorsite_override: "Latency",
        connection_name: connectionName,
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

  const fqdnId = await ensureFqdnOnConnection({ connectionId, sipHost, actions });

  const connDetail = await telnyxRequest<{ data?: TelnyxRecord }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  const primaryId = String(
    (connDetail.data?.inbound as TelnyxRecord | undefined)?.default_primary_fqdn_id || "",
  );
  if (primaryId !== fqdnId) {
    await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
      method: "PATCH",
      body: {
        inbound: {
          default_primary_fqdn_id: fqdnId,
          default_secondary_fqdn_id: null,
          default_tertiary_fqdn_id: null,
        },
      },
    });
    actions.push(`set_primary_fqdn_${sipHost}`);
  }

  return {
    connectionId,
    fqdnId,
    sipHost,
    created: actions.includes("created_fqdn_connection"),
    actions,
  };
}

/**
 * Configure Telnyx FQDN primary → self-hosted, secondary → LiveKit Cloud for inbound failover.
 * Requires TELNYX_LIVEKIT_FAILOVER_ENABLED=1 and both backends configured.
 */
export async function ensureTelnyxLiveKitInboundFailover(): Promise<{
  connectionId: string;
  primaryFqdnId: string;
  secondaryFqdnId: string;
  actions: string[];
}> {
  if (!isTelnyxLiveKitFailoverEnabled()) {
    throw new Error("Telnyx LiveKit inbound failover is disabled");
  }

  const actions: string[] = [];
  const primary = getAuthoritativeLiveKitSipHostForBackend("self_hosted");
  const secondary = getAuthoritativeLiveKitSipHostForBackend("livekit_cloud");
  const connectionName =
    process.env.TELNYX_LIVEKIT_FAILOVER_CONNECTION_NAME?.trim() ||
    "Transovo LiveKit Inbound Failover";

  let conn = await findFqdnConnectionByName(connectionName);
  if (!conn) {
    const created = await telnyxRequest<{ data?: TelnyxRecord }>("/fqdn_connections", {
      method: "POST",
      body: {
        active: true,
        anchorsite_override: "Latency",
        connection_name: connectionName,
        inbound: {
          ani_number_format: "+E.164",
          dnis_number_format: "+e164",
        },
        transport_protocol: "TCP",
      },
    });
    conn = asRecord(created.data);
    actions.push("created_failover_fqdn_connection");
  }

  const connectionId = String(conn?.id || "");
  if (!connectionId) throw new Error("Failover FQDN connection missing id");

  const primaryFqdnId = await ensureFqdnOnConnection({
    connectionId,
    sipHost: primary.host,
    actions,
  });
  const secondaryFqdnId = await ensureFqdnOnConnection({
    connectionId,
    sipHost: secondary.host,
    actions,
  });

  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
    method: "PATCH",
    body: {
      inbound: {
        default_primary_fqdn_id: primaryFqdnId,
        default_secondary_fqdn_id: secondaryFqdnId,
        default_tertiary_fqdn_id: null,
      },
    },
  });
  actions.push("configured_primary_self_hosted_secondary_cloud");

  return { connectionId, primaryFqdnId, secondaryFqdnId, actions };
}

export function getBackendSipHostSummary(): {
  selfHosted: string;
  cloud: string;
} {
  return {
    selfHosted: getLiveKitBackendConfig("self_hosted").sipHost,
    cloud: getLiveKitBackendConfig("livekit_cloud").sipHost,
  };
}
