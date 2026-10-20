/** LiveKit outbound SIP trunk id for warm/cold transfers (env-backed). */
export function getStoredLiveKitOutboundTrunkId(): string | null {
  const id = process.env.LIVEKIT_OUTBOUND_SIP_TRUNK_ID?.trim();
  return id || null;
}
