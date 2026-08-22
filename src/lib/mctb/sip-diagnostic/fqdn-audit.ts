import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  TELNYX_INBOUND_PRACK_API_FIELD,
  TELNYX_INBOUND_RINGBACK_API_FIELD,
  TELNYX_THIRD_PARTY_CONTROL_API_FIELD,
  readInboundLateMediaSettings,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_571_SIP_FQDN_CONNECTION_NAME,
} from "@/lib/mctb/sip-diagnostic/constants";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export type Mctb571SipFqdnAudit = {
  connectionId: string;
  connectionName: string;
  thirdPartyControlEnabled: boolean | null;
  prackEnabled: boolean | null;
  generateRingbackTone: boolean | null;
  transportProtocol: string | null;
  encryptedMedia: string | null;
  inboundCodecs: string[];
  channelLimit: number | null;
  fqdnDestinations: string[];
  lateMediaReady: boolean;
};

export async function auditMctb571SipFqdnConnection(
  connectionId: string = MCTB_571_SIP_FQDN_CONNECTION_ID,
): Promise<Mctb571SipFqdnAudit> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  const data = asRecord(res.data);
  if (!data?.id) {
    throw new Error(`FQDN connection ${connectionId} not found`);
  }

  const inbound = asRecord(data.inbound);
  const lateMedia = readInboundLateMediaSettings(data, "fqdn");

  const fqdnListed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": connectionId, "page[size]": 20 },
  });
  const fqdnDestinations = (fqdnListed.data || [])
    .map((row) => String(row.fqdn || "").trim())
    .filter(Boolean);

  const thirdPartyControlEnabled = lateMedia.thirdPartyControlEnabled;
  const prackEnabled = lateMedia.prackEnabled;
  const generateRingbackTone = lateMedia.generateRingbackTone;

  return {
    connectionId: String(data.id),
    connectionName: String(data.connection_name || MCTB_571_SIP_FQDN_CONNECTION_NAME),
    thirdPartyControlEnabled,
    prackEnabled,
    generateRingbackTone,
    transportProtocol: data.transport_protocol ? String(data.transport_protocol) : null,
    encryptedMedia: data.encrypted_media ? String(data.encrypted_media) : null,
    inboundCodecs: lateMedia.codecs || [],
    channelLimit:
      typeof inbound?.channel_limit === "number" ? inbound.channel_limit : null,
    fqdnDestinations,
    lateMediaReady:
      thirdPartyControlEnabled === true &&
      prackEnabled === true &&
      generateRingbackTone === true,
  };
}

export async function ensureMctb571SipFqdnLateMediaSettings(
  connectionId: string = MCTB_571_SIP_FQDN_CONNECTION_ID,
): Promise<{ patched: boolean; audit: Mctb571SipFqdnAudit }> {
  const before = await auditMctb571SipFqdnConnection(connectionId);
  if (before.lateMediaReady) {
    return { patched: false, audit: before };
  }

  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
    method: "PATCH",
    body: {
      [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: true,
      inbound: {
        [TELNYX_INBOUND_PRACK_API_FIELD]: true,
        [TELNYX_INBOUND_RINGBACK_API_FIELD]: true,
        instant_ringback_enabled: false,
        codecs: ["G711U", "G711A", "G722", "G729"],
      },
    },
  });

  const after = await auditMctb571SipFqdnConnection(connectionId);
  return { patched: true, audit: after };
}

export async function fetch571PhoneAssignment(): Promise<{
  e164: string;
  providerNumberId: string;
  connectionId: string;
  connectionName: string;
  connectionKind: string;
  messagingProfileId: string | null;
  messagingProfileName: string | null;
}> {
  const { MCTB_PLATFORM_DEMO_E164 } = await import("@/lib/mctb/onboarding/constants");
  const { classifyTelnyxConnectionId } = await import(
    "@/lib/mctb/consent-prompt/telnyx-call-control-route"
  );

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": MCTB_PLATFORM_DEMO_E164, "page[size]": 1 },
  });
  const pn = listed.data?.[0];
  if (!pn?.id) {
    throw new Error(`Phone number ${MCTB_PLATFORM_DEMO_E164} not found`);
  }

  const connectionId = String(pn.connection_id || "");
  const kind = connectionId ? await classifyTelnyxConnectionId(connectionId) : "unknown";

  return {
    e164: MCTB_PLATFORM_DEMO_E164,
    providerNumberId: String(pn.id),
    connectionId,
    connectionName: String(pn.connection_name || ""),
    connectionKind: kind,
    messagingProfileId: pn.messaging_profile_id ? String(pn.messaging_profile_id) : null,
    messagingProfileName: pn.messaging_profile_name ? String(pn.messaging_profile_name) : null,
  };
}
