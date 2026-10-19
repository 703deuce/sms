import { telnyxRequest } from "@/lib/server/telnyx/client";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

function parseTelephonyCredentialToken(res: unknown): string | null {
  if (typeof res === "string") {
    const trimmed = res.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!res || typeof res !== "object") return null;
  const data = (res as { data?: unknown }).data;
  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (data && typeof data === "object" && "token" in data) {
    const t = (data as { token?: unknown }).token;
    return typeof t === "string" && t.trim().length > 0 ? t.trim() : null;
  }
  return null;
}

export async function getWebRtcLoginToken() {
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
  if (!credentialId) {
    phoneServerLog("webrtc-token", "unconfigured", { reason: "no_credential_id" });
    return { mode: "unconfigured" as const, loginToken: null, error: "TELNYX_TELEPHONY_CREDENTIAL_ID is not set" };
  }

  try {
    // Telnyx returns HTTP 201 with a plain-text JWT body (not JSON). telnyxRequest keeps that as a string.
    const res = await telnyxRequest<unknown>(
      `/telephony_credentials/${credentialId}/token`,
      { method: "POST", body: {} },
    );
    const token = parseTelephonyCredentialToken(res);
    if (!token) {
      phoneServerLog("webrtc-token", "mint_failed", { reason: "empty_token" });
      return { mode: "error" as const, loginToken: null, error: "Telnyx returned no login token" };
    }
    phoneServerLog("webrtc-token", "mint_ok", { tokenLength: token.length });
    return { mode: "telnyx" as const, loginToken: token };
  } catch (e) {
    phoneServerLog("webrtc-token", "mint_error", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return {
      mode: "error" as const,
      loginToken: null,
      error: e instanceof Error ? e.message : "Failed to fetch WebRTC token",
    };
  }
}
