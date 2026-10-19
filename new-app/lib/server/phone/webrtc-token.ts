import { telnyxRequest } from "@/lib/server/telnyx/client";

export async function getWebRtcLoginToken() {
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
  if (!credentialId) {
    return { mode: "unconfigured" as const, loginToken: null, error: "TELNYX_TELEPHONY_CREDENTIAL_ID is not set" };
  }

  try {
    const res = await telnyxRequest<{ data: string | { token?: string } }>(
      `/telephony_credentials/${credentialId}/token`,
      { method: "POST", body: {} },
    );
    const token =
      typeof res.data === "string"
        ? res.data
        : (res as { data?: { token?: string } }).data?.token;
    if (!token) {
      return { mode: "error" as const, loginToken: null, error: "Telnyx returned no login token" };
    }
    return { mode: "telnyx" as const, loginToken: token };
  } catch (e) {
    return {
      mode: "error" as const,
      loginToken: null,
      error: e instanceof Error ? e.message : "Failed to fetch WebRTC token",
    };
  }
}
