import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import {
  auditMctb571SipFqdnConnection,
  ensureMctb571SipFqdnLateMediaSettings,
} from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_FQDN_DIRECT_CONNECTION_NAME,
  MCTB_FQDN_DIRECT_TEST_E164,
} from "@/lib/mctb/sip-diagnostic/constants";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function isTollFreeE164(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("18");
}

export function mctbFqdnDirectEventOnlyWebhookUrl(): string {
  return getTelnyxWebhookUrls().mctbEventOnly;
}

export function mctbLiveKitFqdnWebhookUrl(): string {
  return getTelnyxWebhookUrls().voice;
}

export async function fetchFqdnConnectionRaw(
  connectionId: string,
): Promise<Record<string, unknown> | null> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  return asRecord(res.data);
}

export async function findFqdnConnectionByName(
  name: string,
): Promise<Record<string, unknown> | null> {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdn_connections", {
    query: { "page[size]": 100 },
  });
  return (res.data || []).find((row) => String(row.connection_name || "") === name) || null;
}

export async function listFqdnDestinations(connectionId: string): Promise<string[]> {
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": connectionId, "page[size]": 20 },
  });
  return (listed.data || [])
    .map((row) => String(row.fqdn || "").trim())
    .filter(Boolean);
}

/**
 * Dedicated FQDN with same PRACK/3PCC as LiveKit ingress but NO SIP destinations.
 * PSTN on this connection becomes programmable Call Control (webhook + answer).
 */
export async function ensureMctbFqdnDirectConnection(): Promise<{
  connectionId: string;
  created: boolean;
  fqdnDestinations: string[];
}> {
  const webhookUrl = mctbFqdnDirectEventOnlyWebhookUrl();
  const inbound = {
    ani_number_format: "+E.164",
    dnis_number_format: "e164",
    codecs: ["G722", "G711U", "G711A", "G729"],
    instant_ringback_enabled: false,
    generate_ringback_tone: true,
    prack_enabled: true,
    default_primary_fqdn_id: null,
    default_secondary_fqdn_id: null,
    default_tertiary_fqdn_id: null,
  };

  const existing = await findFqdnConnectionByName(MCTB_FQDN_DIRECT_CONNECTION_NAME);
  if (existing?.id) {
    const connectionId = String(existing.id);
    await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
      method: "PATCH",
      body: {
        active: true,
        third_party_control_enabled: true,
        webhook_event_url: webhookUrl,
        webhook_api_version: "2",
        inbound,
      },
    });
    return {
      connectionId,
      created: false,
      fqdnDestinations: await listFqdnDestinations(connectionId),
    };
  }

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>("/fqdn_connections", {
    method: "POST",
    body: {
      active: true,
      connection_name: MCTB_FQDN_DIRECT_CONNECTION_NAME,
      transport_protocol: "TCP",
      anchorsite_override: "Latency",
      third_party_control_enabled: true,
      webhook_event_url: webhookUrl,
      webhook_api_version: "2",
      inbound,
    },
  });
  const connectionId = String(asRecord(created.data)?.id || "");
  if (!connectionId) throw new Error("Failed to create MCTB FQDN Direct connection");
  return { connectionId, created: true, fqdnDestinations: [] };
}

export async function listTelnyxTollFreeCandidates(): Promise<
  Array<{ e164: string; connectionId: string; connectionName: string; providerNumberId: string }>
> {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "page[size]": 50 },
  });
  const exclude571 = MCTB_PLATFORM_DEMO_E164.replace(/\D/g, "").slice(-10);
  return (res.data || [])
    .map((row) => ({
      e164: String(row.phone_number || ""),
      connectionId: String(row.connection_id || ""),
      connectionName: String(row.connection_name || ""),
      providerNumberId: String(row.id || ""),
    }))
    .filter((row) => row.e164 && isTollFreeE164(row.e164))
    .filter((row) => !row.e164.replace(/\D/g, "").endsWith(exclude571));
}

export async function resolveFqdnDirectTestE164(): Promise<string> {
  const preferred = await fetchTelnyxPhoneNumberByE164(MCTB_FQDN_DIRECT_TEST_E164);
  if (preferred?.phone_number) return String(preferred.phone_number);
  const candidates = await listTelnyxTollFreeCandidates();
  const direct = await findFqdnConnectionByName(MCTB_FQDN_DIRECT_CONNECTION_NAME);
  if (direct?.id) {
    const onDirect = candidates.find((c) => c.connectionId === String(direct.id));
    if (onDirect) return onDirect.e164;
  }
  if (candidates[0]?.e164) return candidates[0].e164;
  throw new Error("No Telnyx toll-free available (excluding platform 571)");
}

export async function assignE164ToFqdnConnection(
  e164: string,
  connectionId: string,
): Promise<{ providerNumberId: string; liveConnectionId: string }> {
  const pn = await fetchTelnyxPhoneNumberByE164(e164);
  if (!pn?.id) throw new Error(`Telnyx number ${e164} not found`);
  const providerNumberId = String(pn.id);

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId = String(asRecord(verify.data)?.connection_id || "");
  if (liveConnectionId !== connectionId) {
    throw new Error(
      `Assignment failed for ${e164}: expected ${connectionId}, live ${liveConnectionId || "(none)"}`,
    );
  }
  return { providerNumberId, liveConnectionId };
}

export async function patchFqdnWebhook(
  connectionId: string,
  webhookUrl: string,
): Promise<{ previousWebhookUrl: string | null; webhookUrl: string }> {
  const before = await fetchFqdnConnectionRaw(connectionId);
  const previousWebhookUrl = before?.webhook_event_url
    ? String(before.webhook_event_url)
    : before?.webhook_url
      ? String(before.webhook_url)
      : null;

  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
    method: "PATCH",
    body: {
      webhook_event_url: webhookUrl,
      webhook_api_version: "2",
    },
  });

  return { previousWebhookUrl, webhookUrl };
}

export async function restoreFqdnWebhook(input: {
  connectionId: string;
  webhookUrl: string | null;
}): Promise<void> {
  if (!input.webhookUrl) {
    console.warn("No previous FQDN webhook URL to restore — skipping PATCH");
    return;
  }
  await patchFqdnWebhook(input.connectionId, input.webhookUrl);
}

export async function verifyFqdnDirectMctbRoute(): Promise<{
  ok: boolean;
  testE164: string;
  directFqdnConnectionId: string;
  directFqdnConnectionName: string;
  webhookUrl: string;
  liveWebhookUrl: string | null;
  lateMediaReady: boolean;
  livekitFqdnDestinations: string[];
  detail: string;
}> {
  const direct = await ensureMctbFqdnDirectConnection();
  const testE164 = await resolveFqdnDirectTestE164();
  const webhookUrl = mctbFqdnDirectEventOnlyWebhookUrl();
  const fqdnRaw = await fetchFqdnConnectionRaw(direct.connectionId);
  const liveWebhook = fqdnRaw?.webhook_event_url
    ? String(fqdnRaw.webhook_event_url).replace(/\/$/, "")
    : fqdnRaw?.webhook_url
      ? String(fqdnRaw.webhook_url).replace(/\/$/, "")
      : null;

  const audit = await auditMctb571SipFqdnConnection(direct.connectionId);
  const pn = await fetchTelnyxPhoneNumberByE164(testE164);
  const onDirect = String(pn?.connection_id || "") === direct.connectionId;
  const noLiveKitDestinations = direct.fqdnDestinations.length === 0;

  const ok =
    onDirect &&
    noLiveKitDestinations &&
    liveWebhook === webhookUrl.replace(/\/$/, "") &&
    audit.lateMediaReady;

  return {
    ok,
    testE164,
    directFqdnConnectionId: direct.connectionId,
    directFqdnConnectionName: MCTB_FQDN_DIRECT_CONNECTION_NAME,
    webhookUrl,
    liveWebhookUrl: liveWebhook,
    lateMediaReady: audit.lateMediaReady,
    livekitFqdnDestinations: direct.fqdnDestinations,
    detail: ok
      ? `${testE164} on ${MCTB_FQDN_DIRECT_CONNECTION_NAME} (no LiveKit SIP dest) → mctb-event-only`
      : `e164=${testE164} onDirect=${onDirect} noLkDest=${noLiveKitDestinations} webhook=${liveWebhook || "(none)"} lateMedia=${audit.lateMediaReady}`,
  };
}

export async function prepareFqdnForDirectMctb(): Promise<{
  lateMediaPatched: boolean;
  audit: Awaited<ReturnType<typeof auditMctb571SipFqdnConnection>>;
  directConnectionId: string;
}> {
  const direct = await ensureMctbFqdnDirectConnection();
  const enabled = await ensureMctb571SipFqdnLateMediaSettings(direct.connectionId);
  return {
    lateMediaPatched: enabled.patched,
    audit: enabled.audit,
    directConnectionId: direct.connectionId,
  };
}

/** Restore production LiveKit FQDN webhook (we must not leave it on mctb-event-only). */
export async function restoreLiveKitFqdnForProduction(
  previousWebhookUrl?: string | null,
): Promise<void> {
  const webhookUrl = (previousWebhookUrl || mctbLiveKitFqdnWebhookUrl()).replace(/\/$/, "");
  await patchFqdnWebhook(MCTB_571_SIP_FQDN_CONNECTION_ID, webhookUrl);
}
