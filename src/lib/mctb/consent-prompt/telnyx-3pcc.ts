import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";

/** MCTB 571 Call Control diagnostic application (current AT&T forward test path). */
export const MCTB_571_CALL_CONTROL_DIAG_APP_ID = "3031983555518399856";

/** Telnyx API field for portal "Enable 3rd Party Call Control" (late-media negotiation). */
export const TELNYX_THIRD_PARTY_CONTROL_API_FIELD = "third_party_control_enabled" as const;

export type TelnyxConnectionKind =
  | "call_control"
  | "texml"
  | "credential"
  | "fqdn"
  | "ip"
  | "unknown";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Read 3PCC flag from any Telnyx connection object shape. */
export function readThirdPartyControlEnabled(
  connection: Record<string, unknown> | null,
): boolean | null {
  if (!connection) return null;
  const top = connection[TELNYX_THIRD_PARTY_CONTROL_API_FIELD];
  if (typeof top === "boolean") return top;
  const inbound = asRecord(connection.inbound);
  const inboundValue =
    inbound?.third_party_call_control ??
    inbound?.enable_third_party_call_control ??
    inbound?.third_party_control;
  if (typeof inboundValue === "boolean") return inboundValue;
  return null;
}

export async function classifyTelnyxResourceId(
  connectionId: string,
): Promise<TelnyxConnectionKind> {
  if (!connectionId) return "unknown";
  const probes: Array<{ kind: TelnyxConnectionKind; path: string }> = [
    { kind: "call_control", path: `/call_control_applications/${encodeURIComponent(connectionId)}` },
    { kind: "texml", path: `/texml_applications/${encodeURIComponent(connectionId)}` },
    { kind: "credential", path: `/credential_connections/${encodeURIComponent(connectionId)}` },
    { kind: "fqdn", path: `/fqdn_connections/${encodeURIComponent(connectionId)}` },
    { kind: "ip", path: `/ip_connections/${encodeURIComponent(connectionId)}` },
  ];
  for (const probe of probes) {
    try {
      const res = await telnyxRequest<{ data?: Record<string, unknown> }>(probe.path);
      if (asRecord(res.data)?.id) return probe.kind;
    } catch {
      // not this type
    }
  }
  return "unknown";
}

export async function fetchConnectionThirdPartyControl(connectionId: string): Promise<{
  connectionId: string;
  kind: TelnyxConnectionKind;
  thirdPartyControlEnabled: boolean | null;
  apiFieldReadable: boolean;
  connectionName: string | null;
}> {
  const kind = await classifyTelnyxResourceId(connectionId);
  let path = `/connections/${encodeURIComponent(connectionId)}`;
  if (kind === "call_control") path = `/call_control_applications/${encodeURIComponent(connectionId)}`;
  if (kind === "texml") path = `/texml_applications/${encodeURIComponent(connectionId)}`;
  if (kind === "credential") path = `/credential_connections/${encodeURIComponent(connectionId)}`;
  if (kind === "fqdn") path = `/fqdn_connections/${encodeURIComponent(connectionId)}`;
  if (kind === "ip") path = `/ip_connections/${encodeURIComponent(connectionId)}`;

  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(path);
  const data = asRecord(res.data) || {};
  const thirdPartyControlEnabled = readThirdPartyControlEnabled(data);
  const apiFieldReadable = thirdPartyControlEnabled !== null;
  const connectionName = String(
    data.application_name || data.friendly_name || data.connection_name || "",
  ) || null;

  return {
    connectionId,
    kind,
    thirdPartyControlEnabled,
    apiFieldReadable,
    connectionName,
  };
}

/** Audit both MCTB 571 voice connections referenced by Telnyx support. */
export async function auditMctb571ThirdPartyControl(): Promise<
  Array<{
    label: string;
    connectionId: string;
    kind: TelnyxConnectionKind;
    thirdPartyControlEnabled: boolean | null;
    apiFieldReadable: boolean;
    connectionName: string | null;
    is571LiveConnection: boolean;
  }>
> {
  const targets = [
    { label: "call_control_diagnostic", connectionId: MCTB_571_CALL_CONTROL_DIAG_APP_ID },
    { label: "texml_consent", connectionId: MCTB_571_CONSENT_TEXML_APP_ID },
  ];

  const pn = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": "+15714073615", "page[size]": 1 },
  });
  const liveConnectionId = String(pn.data?.[0]?.connection_id || "");

  const rows = [];
  for (const target of targets) {
    const row = await fetchConnectionThirdPartyControl(target.connectionId);
    rows.push({
      label: target.label,
      ...row,
      is571LiveConnection: liveConnectionId === target.connectionId,
    });
  }
  return rows;
}
