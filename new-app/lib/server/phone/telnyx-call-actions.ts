import { telnyxRequest } from "@/lib/server/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

/** Telnyx call_control_id values are `v3:…` and must be encoded in URL paths. */
export function telnyxCallControlPath(controlId: string, suffix: string) {
  return `/calls/${encodeURIComponent(controlId)}${suffix}`;
}

export async function telnyxCallAction(
  controlId: string,
  action: string,
  body?: Record<string, unknown>,
) {
  if (!controlId || controlId.startsWith("mock_") || !isTelnyxPhoneConfigured()) return;
  try {
    await telnyxRequest(telnyxCallControlPath(controlId, `/actions/${action}`), {
      method: "POST",
      body: body ?? {},
    });
    phoneServerLog("telnyx-call-action", "ok", {
      action,
      controlIdPrefix: controlId.slice(0, 8),
    });
  } catch (err) {
    phoneServerLog("telnyx-call-action", "failed", {
      action,
      controlIdPrefix: controlId.slice(0, 8),
      error: err instanceof Error ? err.message : "unknown",
    });
    throw err;
  }
}

export function encodeTelnyxClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}
