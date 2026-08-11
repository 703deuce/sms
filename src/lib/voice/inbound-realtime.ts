/**
 * @deprecated Inbound LiveKit calls are frontdesk-only. These env vars are ignored.
 */
export function isInboundRealtimeEnabled(): boolean {
  return false;
}

export function inboundRealtimeProfileLabel(_useFrontDesk: boolean): string {
  return "frontdesk_realtime";
}
