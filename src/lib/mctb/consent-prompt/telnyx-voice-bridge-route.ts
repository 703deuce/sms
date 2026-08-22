import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import {
  assign571ToConnection,
  fetchTelnyxPhoneNumberByE164,
} from "@/lib/mctb/consent-prompt/telnyx-call-control-route";

export const MCTB_571_VOICE_BRIDGE_APP_NAME = "MCTB 571 Voice Bridge";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function mctb571VoiceBridgeWebhookUrl(): string {
  return getTelnyxWebhookUrls().mctbVoiceBridge;
}

export async function ensureMctb571VoiceBridgeCallControlApplication(): Promise<string> {
  const webhookUrl = mctb571VoiceBridgeWebhookUrl();
  const preferred = process.env.MCTB_571_VOICE_BRIDGE_CALL_CONTROL_APP_ID?.trim() || "";

  if (preferred) {
    try {
      await telnyxRequest(`/call_control_applications/${encodeURIComponent(preferred)}`, {
        method: "PATCH",
        body: {
          application_name: MCTB_571_VOICE_BRIDGE_APP_NAME,
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
      String(row.application_name || "") === MCTB_571_VOICE_BRIDGE_APP_NAME,
  );
  if (existing?.id) return String(existing.id);

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>(
    "/call_control_applications",
    {
      method: "POST",
      body: {
        application_name: MCTB_571_VOICE_BRIDGE_APP_NAME,
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
  if (!id) throw new Error("Failed to create MCTB 571 Voice Bridge Call Control application");
  return id;
}

export async function verify571VoiceBridgeRoute(): Promise<{
  ok: boolean;
  callControlAppId: string | null;
  webhookUrl: string;
  liveConnectionId: string | null;
  detail: string;
}> {
  const webhookUrl = mctb571VoiceBridgeWebhookUrl();
  let callControlAppId: string | null = null;
  try {
    callControlAppId = await ensureMctb571VoiceBridgeCallControlApplication();
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
      ? `571 on Voice Bridge ${callControlAppId}`
      : `Expected ${callControlAppId}, live ${liveConnectionId || "(none)"}`,
  };
}

export { assign571ToConnection, fetchTelnyxPhoneNumberByE164 };
