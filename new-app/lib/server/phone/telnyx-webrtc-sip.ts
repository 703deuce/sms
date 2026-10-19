/**
 * Telnyx WebRTC agent destinations — see:
 * - https://developers.telnyx.com/api-reference/call-commands/transfer-call
 * - https://developers.telnyx.com/docs/voice/webrtc/sdk-commonalities
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
