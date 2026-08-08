import { z } from "zod";

export type AmyProcessUserData = {
  callContext?: import("@/lib/voice/domain-actions").LiveKitCallContext;
};

export const roomMetadataSchema = z.object({
  workspaceId: z.string().min(1),
  agentId: z.string().min(1),
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
  if (!attrs.workspaceId || !attrs.agentId) return null;
  return roomMetadataSchema.parse({
    workspaceId: attrs.workspaceId,
    agentId: attrs.agentId,
    fromE164: attrs.fromE164 || attrs.callerNumber,
    toE164: attrs.toE164 || attrs.calledNumber,
    callId: attrs.callId,
  });
}
