import { TRANSOVO_OUTBOUND_ROOM_PREFIX } from "@/lib/voice/outbound/outbound-call-service";

export function isOutboundRoomName(roomName: string | undefined): boolean {
  return Boolean(roomName?.startsWith(TRANSOVO_OUTBOUND_ROOM_PREFIX));
}
