/**
 * Inbound OpenAI Realtime — shared env gate for Amy + frontdesk LiveKit paths.
 *
 * Your inbound DID may route to Amy (profile "amy") or frontdesk (profile "frontdesk").
 * FRONTDESK_REALTIME_TEST only upgrades the frontdesk DB profile; Amy needs this runtime flag.
 */
export function isInboundRealtimeEnabled(): boolean {
  return (
    process.env.VOICE_INBOUND_REALTIME?.trim() === "1" ||
    process.env.INBOUND_REALTIME_TEST?.trim() === "1" ||
    process.env.FRONTDESK_REALTIME_TEST?.trim() === "1"
  );
}

export function inboundRealtimeProfileLabel(useFrontDesk: boolean): string {
  if (useFrontDesk) return "frontdesk_realtime";
  return "amy_realtime";
}
