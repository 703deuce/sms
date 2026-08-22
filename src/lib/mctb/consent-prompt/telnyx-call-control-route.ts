import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";

export const MCTB_571_CALL_CONTROL_DIAG_APP_NAME = "MCTB 571 Call Control Diagnostic";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function mctb571CallControlDiagnosticWebhookUrl(): string {
  return getTelnyxWebhookUrls().mctbCallControlDiagnostic;
}

export async function fetchTelnyxPhoneNumberByE164(e164: string): Promise<Record<string, unknown> | null> {
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": e164, "page[size]": 1 },
  });
  return listed.data?.[0] ?? null;
}

export async function classifyTelnyxConnectionId(
  connectionId: string,
): Promise<"texml" | "call_control" | "sip" | "unknown"> {
  if (!connectionId) return "unknown";
  if (connectionId === MCTB_571_CONSENT_TEXML_APP_ID) return "texml";
  try {
    const texml = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/texml_applications/${encodeURIComponent(connectionId)}`,
    );
    if (asRecord(texml.data)?.id) return "texml";
  } catch {
    // not texml
  }
  try {
    const cc = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/call_control_applications/${encodeURIComponent(connectionId)}`,
    );
    if (asRecord(cc.data)?.id) return "call_control";
  } catch {
    // not call control
  }
  try {
    const sip = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/connections/${encodeURIComponent(connectionId)}`,
    );
    if (asRecord(sip.data)?.id) return "sip";
  } catch {
    // not sip
  }
  return "unknown";
}

/** Find or create isolated Call Control app — never reuse TeXML or TELNYX_CONNECTION_ID. */
export async function ensureMctb571CallControlDiagnosticApplication(): Promise<string> {
  const webhookUrl = mctb571CallControlDiagnosticWebhookUrl();
  const preferred = process.env.MCTB_PLATFORM_CONSENT_CALL_CONTROL_APP_ID?.trim() || "";

  if (preferred) {
    try {
      await telnyxRequest(`/call_control_applications/${encodeURIComponent(preferred)}`, {
        method: "PATCH",
        body: {
          application_name: MCTB_571_CALL_CONTROL_DIAG_APP_NAME,
          webhook_event_url: webhookUrl,
          webhook_api_version: "2",
          active: true,
          first_command_timeout: true,
          first_command_timeout_secs: 30,
        },
      });
      return preferred;
    } catch {
      // fall through
    }
  }

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/call_control_applications",
    { query: { "page[size]": 50 } },
  );
  const rows = Array.isArray(listed.data) ? listed.data : [];
  const existing = rows.find(
    (row) =>
      String(row.webhook_event_url || "").replace(/\/$/, "") === webhookUrl.replace(/\/$/, "") ||
      String(row.application_name || "") === MCTB_571_CALL_CONTROL_DIAG_APP_NAME,
  );
  if (existing?.id) return String(existing.id);

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>(
    "/call_control_applications",
    {
      method: "POST",
      body: {
        application_name: MCTB_571_CALL_CONTROL_DIAG_APP_NAME,
        webhook_event_url: webhookUrl,
        webhook_api_version: "2",
        active: true,
        first_command_timeout: true,
        first_command_timeout_secs: 30,
      },
    },
  );
  const app = asRecord(created.data) || asRecord(created) || {};
  const id = String(app.id || "");
  if (!id) throw new Error("Failed to create MCTB Call Control diagnostic application");
  return id;
}

export async function assign571ToConnection(connectionId: string): Promise<{
  providerNumberId: string;
  liveConnectionId: string;
}> {
  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  if (!pn?.id) throw new Error(`Telnyx number ${MCTB_PLATFORM_DEMO_E164} not found`);
  const providerNumberId = String(pn.id);

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");
  if (liveConnectionId !== connectionId) {
    throw new Error(
      `571 assignment failed: expected ${connectionId}, live ${liveConnectionId || "(none)"}`,
    );
  }
  return { providerNumberId, liveConnectionId };
}

export async function verify571CallControlDiagnosticRoute(): Promise<{
  ok: boolean;
  callControlAppId: string | null;
  webhookUrl: string;
  liveConnectionId: string | null;
  detail: string;
}> {
  const webhookUrl = mctb571CallControlDiagnosticWebhookUrl();
  let callControlAppId: string | null = null;
  try {
    callControlAppId = await ensureMctb571CallControlDiagnosticApplication();
  } catch (err) {
    return {
      ok: false,
      callControlAppId: null,
      webhookUrl,
      liveConnectionId: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const pn = await fetchTelnyxPhoneNumberByE164(MCTB_PLATFORM_DEMO_E164);
  const liveConnectionId = pn?.connection_id ? String(pn.connection_id) : null;
  const ok = Boolean(callControlAppId && liveConnectionId === callControlAppId);
  return {
    ok,
    callControlAppId,
    webhookUrl,
    liveConnectionId,
    detail: ok
      ? `571 on Call Control diagnostic ${callControlAppId}`
      : `Expected ${callControlAppId}, live ${liveConnectionId || "(none)"}`,
  };
}
