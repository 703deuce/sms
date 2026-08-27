import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import { MCTB_TWILIO_VOICE_INGRESS_E164 } from "@/lib/mctb/onboarding/constants";
import {
  ensureMctb571SipFqdnLateMediaSettings,
  auditMctb571SipFqdnConnection,
} from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";

export const MCTB_DIRECT_TELNYX_TEST_FQDN_APP_NAME = "MCTB Direct Telnyx Test (FQDN 3PCC)";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function mctbDirectTelnyxTestWebhookUrl(): string {
  return getTelnyxWebhookUrls().mctbDirectTelnyxTest;
}

export async function fetchFqdnConnectionRaw(
  connectionId: string = MCTB_571_SIP_FQDN_CONNECTION_ID,
): Promise<Record<string, unknown> | null> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  return asRecord(res.data);
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

/**
 * Point FQDN SIP connection (3PCC + PRACK) at direct-test webhook.
 * Does not remove LiveKit FQDN destination — 3PCC holds the call before SIP bridge.
 */
export async function patchFqdnDirectTestWebhook(input?: {
  connectionId?: string;
  webhookUrl?: string;
}): Promise<{ previousWebhookUrl: string | null; webhookUrl: string }> {
  const connectionId = input?.connectionId || MCTB_571_SIP_FQDN_CONNECTION_ID;
  const webhookUrl = (input?.webhookUrl || mctbDirectTelnyxTestWebhookUrl()).replace(/\/$/, "");
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
  connectionId?: string;
  webhookUrl: string | null;
}): Promise<void> {
  const connectionId = input.connectionId || MCTB_571_SIP_FQDN_CONNECTION_ID;
  if (!input.webhookUrl) {
    console.warn("No previous FQDN webhook URL to restore — skipping PATCH");
    return;
  }
  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
    method: "PATCH",
    body: {
      webhook_event_url: input.webhookUrl,
      webhook_api_version: "2",
    },
  });
}

export async function verifyDirectTelnyxTestRoute(e164: string = MCTB_TWILIO_VOICE_INGRESS_E164): Promise<{
  ok: boolean;
  e164: string;
  connectionId: string | null;
  webhookUrl: string;
  lateMediaReady: boolean;
  detail: string;
}> {
  const webhookUrl = mctbDirectTelnyxTestWebhookUrl();
  const pn = await fetchTelnyxPhoneNumberByE164(e164);
  const connectionId = pn?.connection_id ? String(pn.connection_id) : null;
  const fqdn = await auditMctb571SipFqdnConnection();
  const fqdnRaw = await fetchFqdnConnectionRaw();
  const liveWebhook = fqdnRaw?.webhook_event_url
    ? String(fqdnRaw.webhook_event_url).replace(/\/$/, "")
    : null;

  const ok =
    connectionId === MCTB_571_SIP_FQDN_CONNECTION_ID &&
    liveWebhook === webhookUrl.replace(/\/$/, "") &&
    fqdn.lateMediaReady;

  return {
    ok,
    e164,
    connectionId,
    webhookUrl,
    lateMediaReady: fqdn.lateMediaReady,
    detail: ok
      ? `${e164} on FQDN ${MCTB_571_SIP_FQDN_CONNECTION_ID} with direct-test webhook`
      : `connection=${connectionId || "(none)"} webhook=${liveWebhook || "(none)"} lateMedia=${fqdn.lateMediaReady}`,
  };
}

export async function prepareFqdnForDirectTelnyxTest(): Promise<{
  lateMediaPatched: boolean;
  audit: Awaited<ReturnType<typeof auditMctb571SipFqdnConnection>>;
}> {
  const enabled = await ensureMctb571SipFqdnLateMediaSettings();
  return { lateMediaPatched: enabled.patched, audit: enabled.audit };
}
