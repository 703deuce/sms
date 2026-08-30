/**
 * Telnyx env helpers and webhook URL builders.
 */

export function getTelnyxApiKey() {
  return process.env.TELNYX_API_KEY?.trim() || "";
}

export function getTelnyxPublicKey() {
  return process.env.TELNYX_PUBLIC_KEY?.trim() || "";
}

export function getTelnyxOrgId() {
  return process.env.TELNYX_ORG_ID?.trim() || "";
}

export function getTelnyxApiBaseUrl() {
  return (
    process.env.TELNYX_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.telnyx.com/v2"
  );
}

export function getTelnyxUseTwexit() {
  const v = process.env.TELNYX_USE_TWEXIT?.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(v || "");
}

/** Platform-level profile only — never use for customer sending. */
export function getTelnyxDefaultMessagingProfileId() {
  return process.env.TELNYX_DEFAULT_MESSAGING_PROFILE_ID?.trim() || "";
}

export function getAppBaseUrl() {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getTelnyxWebhookUrls() {
  const base = getAppBaseUrl();
  return {
    /** Unified messaging profile webhook (inbound + delivery events). */
    messaging: `${base}/api/telnyx/messaging`,
    /** Legacy aliases — still accepted; prefer `messaging`. */
    inbound: `${base}/api/telnyx/inbound`,
    messageStatus: `${base}/api/telnyx/message-status`,
    compliance: `${base}/api/telnyx/compliance`,
    /** Call Control + AI assistant events */
    voice: `${base}/api/telnyx/voice`,
    /** TeXML application status_callback (form or JSON call progress) */
    texmlStatus: `${base}/api/telnyx/voice/texml-status`,
    /** MCTB TeXML-first ingress (carrier → DID → TeXML → MCTB branch) */
    mctbEntry: `${base}/api/telnyx/voice/mctb-entry`,
    /** MCTB Press-1 Gather callback (DTMF consent — keep separate from ingress) */
    mctbConsentTexml: `${base}/api/telnyx/voice/mctb-consent`,
    /** MCTB TeXML press-1-only ingress */
    mctbPress1: `${base}/api/telnyx/voice/mctb-press-1`,
    /** MCTB TeXML voicemail-only ingress (play active.mp3 → record) */
    mctbVoicemail: `${base}/api/telnyx/voice/mctb-voicemail`,
    /** MCTB TeXML voicemail Record callback */
    mctbTexmlVoicemail: `${base}/api/telnyx/voice/mctb-texml-voicemail`,
    /** MCTB platform 571 Call Control diagnostic (separate app — do not mix with TeXML) */
    mctbCallControlDiagnostic: `${base}/api/telnyx/voice/mctb-call-control`,
  };
}

export function assertTelnyxConfigured() {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) {
    throw new Error("Live Telnyx messaging is missing env: TELNYX_API_KEY");
  }
  return { apiKey };
}
