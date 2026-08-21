import { z } from "zod";

/** Shared between LiveKit dispatch + voice-runtime worker. */
export const roomMetadataSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  fromE164: z.string().optional(),
  toE164: z.string().optional(),
  callId: z.string().optional(),
  /** Published voiceAgentVersion id — pinned at dispatch when available. */
  publishedVersionId: z.string().min(1).optional(),
  /** frontdesk | frontdesk_realtime | outbound_* — explicit dispatch hint. */
  livekitProfile: z.string().optional(),
  /** LiveKit Python template id (livekit_basic_voice, livekit_hotel_receptionist, …). */
  agentTemplate: z.string().optional(),
  dispatchSource: z
    .enum(["phone_provision", "sip_metadata", "job_metadata", "did_lookup"])
    .optional(),
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
  const toE164 =
    attrs.toE164 ||
    attrs.calledNumber ||
    attrs["sip.trunkPhoneNumber"] ||
    attrs["sip.trunkNumber"];
  const fromE164 = attrs.fromE164 || attrs.callerNumber || attrs["sip.phoneNumber"];
  if (!attrs.workspaceId && !attrs.agentId && !toE164) return null;
  return roomMetadataSchema.parse({
    workspaceId: attrs.workspaceId,
    agentId: attrs.agentId,
    fromE164,
    toE164,
    callId: attrs.callId,
    publishedVersionId: attrs.publishedVersionId,
    livekitProfile: attrs.livekitProfile,
    agentTemplate: attrs.agentTemplate,
    dispatchSource: attrs.dispatchSource as RoomMetadata["dispatchSource"],
  });
}

export function parseJobDispatchMetadata(raw: string | undefined): RoomMetadata | null {
  return parseRoomMetadata(raw);
}
