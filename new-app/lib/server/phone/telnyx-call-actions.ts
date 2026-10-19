import { telnyxRequest } from "@/lib/server/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

export async function telnyxCallAction(
  controlId: string,
  action: string,
  body?: Record<string, unknown>,
) {
  if (!controlId || controlId.startsWith("mock_") || !isTelnyxPhoneConfigured()) return;
  try {
    await telnyxRequest(`/calls/${controlId}/actions/${action}`, {
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
