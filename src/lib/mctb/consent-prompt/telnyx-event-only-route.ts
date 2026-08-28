import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import {
  assign571ToConnection,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import { TELNYX_THIRD_PARTY_CONTROL_API_FIELD } from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import { MCTB_866_DIRECT_CALL_CONTROL_APP_NAME } from "@/lib/mctb/sip-diagnostic/constants";

export const MCTB_571_EVENT_ONLY_APP_NAME = MCTB_866_DIRECT_CALL_CONTROL_APP_NAME;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function mctb571EventOnlyWebhookUrl(): string {
  return getTelnyxWebhookUrls().mctbEventOnly;
}

/**
 * Shared MCTB Event Only Call Control app (571 production + 866 test).
 * Must keep 3PCC enabled for carrier forwarded (AT&T) no-answer legs.
 */
export async function ensureMctb571EventOnlyCallControlApplication(): Promise<string> {
  const { ensureMctb866DirectCallControlApp } = await import(
    "@/lib/mctb/sip-diagnostic/fqdn-direct-setup"
  );
  return ensureMctb866DirectCallControlApp();
}

export async function verify571EventOnlyRoute(): Promise<{
  ok: boolean;
  callControlAppId: string | null;
  webhookUrl: string;
  liveConnectionId: string | null;
  detail: string;
}> {
  const webhookUrl = mctb571EventOnlyWebhookUrl();
  let callControlAppId: string | null = null;
  try {
    callControlAppId = await ensureMctb571EventOnlyCallControlApplication();
  } catch (err) {
    return {
      ok: false,
      callControlAppId: null,
      webhookUrl,
      liveConnectionId: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const pn = await fetchTelnyxPhoneNumberByE164("+15714073615");
  const liveConnectionId = pn?.connection_id ? String(pn.connection_id) : null;
  const ok = Boolean(callControlAppId && liveConnectionId === callControlAppId);
  return {
    ok,
    callControlAppId,
    webhookUrl,
    liveConnectionId,
    detail: ok
      ? `571 on Event Only ${callControlAppId}`
      : `Expected ${callControlAppId}, live ${liveConnectionId || "(none)"}`,
  };
}

/** Assign any Telnyx DID to the MCTB Event Only Call Control application. */
export async function assignPhoneNumberToEventOnlyConnection(e164: string): Promise<{
  providerNumberId: string;
  liveConnectionId: string;
  callControlAppId: string;
}> {
  const callControlAppId = await ensureMctb571EventOnlyCallControlApplication();
  const pn = await fetchTelnyxPhoneNumberByE164(e164);
  if (!pn?.id) throw new Error(`Telnyx number ${e164} not found`);
  const providerNumberId = String(pn.id);

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: callControlAppId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");
  if (liveConnectionId !== callControlAppId) {
    throw new Error(
      `${e164} assignment failed: expected ${callControlAppId}, live ${liveConnectionId || "(none)"}`,
    );
  }
  return { providerNumberId, liveConnectionId, callControlAppId };
}

export async function verifyEventOnlyRouteForE164(e164: string): Promise<{
  ok: boolean;
  callControlAppId: string | null;
  webhookUrl: string;
  liveConnectionId: string | null;
  detail: string;
}> {
  const webhookUrl = mctb571EventOnlyWebhookUrl();
  let callControlAppId: string | null = null;
  try {
    callControlAppId = await ensureMctb571EventOnlyCallControlApplication();
  } catch (err) {
    return {
      ok: false,
      callControlAppId: null,
      webhookUrl,
      liveConnectionId: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const pn = await fetchTelnyxPhoneNumberByE164(e164);
  const liveConnectionId = pn?.connection_id ? String(pn.connection_id) : null;
  const ok = Boolean(callControlAppId && liveConnectionId === callControlAppId);
  return {
    ok,
    callControlAppId,
    webhookUrl,
    liveConnectionId,
    detail: ok
      ? `${e164} on Event Only ${callControlAppId}`
      : `Expected ${callControlAppId}, live ${liveConnectionId || "(none)"}`,
  };
}

export { assign571ToConnection, fetchTelnyxPhoneNumberByE164 };
