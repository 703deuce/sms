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
  TELNYX_THIRD_PARTY_CONTROL_API_FIELD,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_866_DIRECT_CALL_CONTROL_APP_NAME,
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
export async function ensureMctb866DirectCallControlApp(): Promise<string> {
  const webhookUrl = mctbFqdnDirectEventOnlyWebhookUrl();
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/call_control_applications",
    { query: { "page[size]": 50 } },
  );
  const existing = (listed.data || []).find(
    (row) =>
      String(row.application_name || "") === MCTB_866_DIRECT_CALL_CONTROL_APP_NAME ||
      String(row.webhook_event_url || "").replace(/\/$/, "") === webhookUrl.replace(/\/$/, ""),
  );
  const appId = existing?.id ? String(existing.id) : null;

  const body = {
    application_name: MCTB_866_DIRECT_CALL_CONTROL_APP_NAME,
    webhook_event_url: webhookUrl,
    webhook_api_version: "2",
    active: true,
    first_command_timeout: true,
    first_command_timeout_secs: 30,
    [TELNYX_THIRD_PARTY_CONTROL_API_FIELD]: true,
  };

  if (appId) {
    await telnyxRequest(`/call_control_applications/${encodeURIComponent(appId)}`, {
      method: "PATCH",
      body,
    });
    return appId;
  }

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>(
    "/call_control_applications",
    { method: "POST", body },
  );
  const id = String(asRecord(created.data)?.id || "");
  if (!id) throw new Error("Failed to create MCTB 866 direct Call Control app");
  return id;
}

export async function fetchCallControlAppRaw(appId: string): Promise<Record<string, unknown> | null> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/call_control_applications/${encodeURIComponent(appId)}`,
  );
  return asRecord(res.data);
}

export async function auditDirectTestLateMedia(input: {
  fqdnConnectionId?: string;
  callControlAppId?: string;
}): Promise<{
  thirdPartyControlEnabled: boolean | null;
  prackEnabled: boolean | null;
  generateRingbackTone: boolean | null;
  lateMediaReady: boolean;
  note: string;
}> {
  const fqdnId = input.fqdnConnectionId;
  const ccId = input.callControlAppId;
  let thirdPartyControlEnabled: boolean | null = null;
  let prackEnabled: boolean | null = null;
  let generateRingbackTone: boolean | null = null;

  if (fqdnId) {
    const fqdnAudit = await auditMctb571SipFqdnConnection(fqdnId);
    thirdPartyControlEnabled = fqdnAudit.thirdPartyControlEnabled;
    prackEnabled = fqdnAudit.prackEnabled;
    generateRingbackTone = fqdnAudit.generateRingbackTone;
  }
  if (ccId) {
    const cc = await fetchCallControlAppRaw(ccId);
    const cc3pcc = cc?.[TELNYX_THIRD_PARTY_CONTROL_API_FIELD];
    if (typeof cc3pcc === "boolean") thirdPartyControlEnabled = cc3pcc;
  }

  const lateMediaReady =
    thirdPartyControlEnabled === true &&
    (prackEnabled === true || prackEnabled === null) &&
    (generateRingbackTone === true || generateRingbackTone === null);

  return {
    thirdPartyControlEnabled,
    prackEnabled,
    generateRingbackTone,
    lateMediaReady,
    note:
      prackEnabled === true
        ? "FQDN PRACK + ringback (183/100rel path) on reference connection"
        : "Call Control 3PCC — PRACK/ringback are FQDN-only; number uses programmable voice",
  };
}

/** Reference FQDN with PRACK/3PCC/ringback — same flags as LiveKit ingress (not used for 866 assignment). */
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

export async function assignE164ToConnection(
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

/** @deprecated Use assignE164ToConnection */
export const assignE164ToFqdnConnection = assignE164ToConnection;

export async function assignE164ToCallControlApp(
  e164: string,
  callControlAppId: string,
): Promise<{ providerNumberId: string; liveConnectionId: string }> {
  return assignE164ToConnection(e164, callControlAppId);
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
  callControlAppId: string;
  callControlAppName: string;
  referenceFqdnConnectionId: string;
  webhookUrl: string;
  liveWebhookUrl: string | null;
  thirdPartyControlEnabled: boolean | null;
  prackEnabled: boolean | null;
  generateRingbackTone: boolean | null;
  lateMediaReady: boolean;
  detail: string;
  note: string;
}> {
  const callControlAppId = await ensureMctb866DirectCallControlApp();
  const reference = await ensureMctbFqdnDirectConnection();
  const testE164 = await resolveFqdnDirectTestE164();
  const webhookUrl = mctbFqdnDirectEventOnlyWebhookUrl();
  const ccRaw = await fetchCallControlAppRaw(callControlAppId);
  const liveWebhook = ccRaw?.webhook_event_url
    ? String(ccRaw.webhook_event_url).replace(/\/$/, "")
    : null;

  const media = await auditDirectTestLateMedia({
    fqdnConnectionId: reference.connectionId,
    callControlAppId,
  });
  const pn = await fetchTelnyxPhoneNumberByE164(testE164);
  const onCallControl = String(pn?.connection_id || "") === callControlAppId;

  const ok =
    onCallControl &&
    liveWebhook === webhookUrl.replace(/\/$/, "") &&
    media.thirdPartyControlEnabled === true;

  return {
    ok,
    testE164,
    callControlAppId,
    callControlAppName: MCTB_866_DIRECT_CALL_CONTROL_APP_NAME,
    referenceFqdnConnectionId: reference.connectionId,
    webhookUrl,
    liveWebhookUrl: liveWebhook,
    thirdPartyControlEnabled: media.thirdPartyControlEnabled,
    prackEnabled: media.prackEnabled,
    generateRingbackTone: media.generateRingbackTone,
    lateMediaReady: media.lateMediaReady,
    note: media.note,
    detail: ok
      ? `${testE164} on Call Control ${callControlAppId} → mctb-event-only (3PCC ON)`
      : `e164=${testE164} onCallControl=${onCallControl} webhook=${liveWebhook || "(none)"} 3pcc=${media.thirdPartyControlEnabled}`,
  };
}

export async function prepareFqdnForDirectMctb(): Promise<{
  lateMediaPatched: boolean;
  callControlAppId: string;
  referenceFqdnConnectionId: string;
  media: Awaited<ReturnType<typeof auditDirectTestLateMedia>>;
}> {
  const callControlAppId = await ensureMctb866DirectCallControlApp();
  const reference = await ensureMctbFqdnDirectConnection();
  const enabled = await ensureMctb571SipFqdnLateMediaSettings(reference.connectionId);
  const media = await auditDirectTestLateMedia({
    fqdnConnectionId: reference.connectionId,
    callControlAppId,
  });
  return {
    lateMediaPatched: enabled.patched,
    callControlAppId,
    referenceFqdnConnectionId: reference.connectionId,
    media,
  };
}

/** Restore production LiveKit FQDN webhook (we must not leave it on mctb-event-only). */
export async function restoreLiveKitFqdnForProduction(
  previousWebhookUrl?: string | null,
): Promise<void> {
  const webhookUrl = (previousWebhookUrl || mctbLiveKitFqdnWebhookUrl()).replace(/\/$/, "");
  await patchFqdnWebhook(MCTB_571_SIP_FQDN_CONNECTION_ID, webhookUrl);
}
