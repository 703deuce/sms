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

export async function fetchFqdnConnectionRaw(
  connectionId: string = MCTB_571_SIP_FQDN_CONNECTION_ID,
): Promise<Record<string, unknown> | null> {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  return asRecord(res.data);
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
  const candidates = await listTelnyxTollFreeCandidates();
  const onFqdn = candidates.find((c) => c.connectionId === MCTB_571_SIP_FQDN_CONNECTION_ID);
  if (onFqdn) return onFqdn.e164;
  const preferred = candidates.find((c) => c.e164 === MCTB_FQDN_DIRECT_TEST_E164);
  if (preferred) return preferred.e164;
  if (candidates[0]?.e164) return candidates[0].e164;
  throw new Error("No Telnyx toll-free available (excluding platform 571)");
}

export async function assignE164ToFqdnConnection(
  e164: string,
  connectionId: string = MCTB_571_SIP_FQDN_CONNECTION_ID,
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

/** Point FQDN 3PCC webhook at existing mctb-event-only handler (same SIP settings, no LiveKit). */
export async function patchFqdnEventOnlyWebhook(input?: {
  connectionId?: string;
  webhookUrl?: string;
}): Promise<{ previousWebhookUrl: string | null; webhookUrl: string }> {
  const connectionId = input?.connectionId || MCTB_571_SIP_FQDN_CONNECTION_ID;
  const webhookUrl = (input?.webhookUrl || mctbFqdnDirectEventOnlyWebhookUrl()).replace(/\/$/, "");
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

export async function verifyFqdnDirectMctbRoute(): Promise<{
  ok: boolean;
  testE164: string;
  fqdnConnectionId: string;
  webhookUrl: string;
  liveWebhookUrl: string | null;
  lateMediaReady: boolean;
  numbersOnFqdn: string[];
  detail: string;
}> {
  const testE164 = await resolveFqdnDirectTestE164();
  const webhookUrl = mctbFqdnDirectEventOnlyWebhookUrl();
  const fqdn = await auditMctb571SipFqdnConnection();
  const fqdnRaw = await fetchFqdnConnectionRaw();
  const liveWebhook = fqdnRaw?.webhook_event_url
    ? String(fqdnRaw.webhook_event_url).replace(/\/$/, "")
    : fqdnRaw?.webhook_url
      ? String(fqdnRaw.webhook_url).replace(/\/$/, "")
      : null;

  const candidates = await listTelnyxTollFreeCandidates();
  const numbersOnFqdn = candidates
    .filter((c) => c.connectionId === MCTB_571_SIP_FQDN_CONNECTION_ID)
    .map((c) => c.e164);

  const pn = await fetchTelnyxPhoneNumberByE164(testE164);
  const onFqdn = String(pn?.connection_id || "") === MCTB_571_SIP_FQDN_CONNECTION_ID;

  const ok =
    onFqdn &&
    liveWebhook === webhookUrl.replace(/\/$/, "") &&
    fqdn.lateMediaReady;

  return {
    ok,
    testE164,
    fqdnConnectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    webhookUrl,
    liveWebhookUrl: liveWebhook,
    lateMediaReady: fqdn.lateMediaReady,
    numbersOnFqdn,
    detail: ok
      ? `${testE164} on FQDN → mctb-event-only (same SIP settings as LiveKit path, LiveKit bypassed)`
      : `e164=${testE164} onFqdn=${onFqdn} webhook=${liveWebhook || "(none)"} lateMedia=${fqdn.lateMediaReady}`,
  };
}

export async function prepareFqdnForDirectMctb(): Promise<{
  lateMediaPatched: boolean;
  audit: Awaited<ReturnType<typeof auditMctb571SipFqdnConnection>>;
}> {
  const enabled = await ensureMctb571SipFqdnLateMediaSettings();
  return { lateMediaPatched: enabled.patched, audit: enabled.audit };
}
