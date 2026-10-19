import { telnyxRequest } from "@/lib/server/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";

export async function telnyxCallAction(
  controlId: string,
  action: string,
  body?: Record<string, unknown>,
) {
  if (!controlId || controlId.startsWith("mock_") || !isTelnyxPhoneConfigured()) return;
  await telnyxRequest(`/calls/${controlId}/actions/${action}`, {
    method: "POST",
    body: body ?? {},
  });
}

export function encodeTelnyxClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}
