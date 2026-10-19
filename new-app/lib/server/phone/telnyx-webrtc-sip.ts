/**
 * Telnyx WebRTC agent destinations.
 *
 * Inbound bridge: server `POST /v2/calls` uses Call Control app id (`TELNYX_CONNECTION_ID`) as
 * `connection_id` and this SIP URI as `to` — see docs/NEW-APP-INBOUND-WEBRTC-CALL-FLOW.md.
 *
 * - https://developers.telnyx.com/api-reference/call-commands/dial
 * - https://developers.telnyx.com/docs/voice/webrtc/use-cases/contact-center
 */
export function buildWebRtcAgentSipUri(sipUsername: string): string {
  const user = sipUsername.trim();
  if (!user) throw new Error("missing_sip_username");
  return `sip:${user}@sip.telnyx.com;secure=srtp`;
}

/** Parse `resource_id` from GET /telephony_credentials/:id (e.g. connection:301673…). */
export function parseTelephonyCredentialConnectionId(resourceId?: string | null): string | null {
  if (!resourceId?.trim()) return null;
  const m = resourceId.match(/^connection:(\d+)$/);
  return m?.[1] ?? null;
}
