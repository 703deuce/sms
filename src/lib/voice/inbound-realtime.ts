/**
 * Inbound OpenAI Realtime — runtime override for Amy inbound path only.
 *
 * Frontdesk uses `frontdesk_realtime` profile (set via FRONTDESK_REALTIME_TEST boot hook).
 * Do not set these if you only want frontdesk on Realtime — Amy will stay on the stack.
 */
export function isInboundRealtimeEnabled(): boolean {
  return (
    process.env.VOICE_INBOUND_REALTIME?.trim() === "1" ||
    process.env.INBOUND_REALTIME_TEST?.trim() === "1"
  );
}

export function inboundRealtimeProfileLabel(useFrontDesk: boolean): string {
  if (useFrontDesk) return "frontdesk_realtime";
  return "amy_realtime";
}
