import { z } from "zod";

/** Shared between LiveKit dispatch + voice-runtime worker. */
export const roomMetadataSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  fromE164: z.string().optional(),
  toE164: z.string().optional(),
  callId: z.string().optional(),
});

export type RoomMetadata = z.infer<typeof roomMetadataSchema>;

export function parseRoomMetadata(raw: string | undefined): RoomMetadata | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = roomMetadataSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseDispatchAttributes(attrs: Record<string, string>): RoomMetadata | null {
  const toE164 = attrs.toE164 || attrs.calledNumber || attrs["sip.trunkPhoneNumber"];
  const fromE164 = attrs.fromE164 || attrs.callerNumber || attrs["sip.phoneNumber"];
  if (!attrs.workspaceId && !attrs.agentId && !toE164) return null;
  return roomMetadataSchema.parse({
    workspaceId: attrs.workspaceId,
    agentId: attrs.agentId,
    fromE164,
    toE164,
    callId: attrs.callId,
  });
}
