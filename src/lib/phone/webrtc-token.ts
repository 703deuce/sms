import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

export async function getWebRtcLoginToken() {
  const apiKey = getTelnyxApiKey();
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();

  if (!apiKey || !credentialId) {
    return { mode: "mock" as const, loginToken: null };
  }

  const res = await telnyxRequest<{ data: string }>(
    `/telephony_credentials/${credentialId}/token`,
    { method: "POST", body: {} },
  );

  const token =
    typeof res.data === "string"
      ? res.data
      : (res as { data?: { token?: string } }).data?.token;

  return { mode: "telnyx" as const, loginToken: token ?? null };
}
