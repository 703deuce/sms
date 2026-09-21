import "server-only";

import { getPrisma } from "@/lib/db";
import { upsertTranscriptSegments } from "@/lib/voice-v3/telemetry/forensics-persist";
import type { VoiceV3CanonicalTurn } from "@/lib/voice-v3/telemetry/call-forensics";

const FORENSICS_META_KEY = "voiceV3Forensics";

export async function materializeNativeTranscriptFromForensicsIfNeeded(
  callId: string,
  workspaceId: string,
): Promise<{ materialized: boolean; turnCount: number }> {
  const prisma = getPrisma();
  const nativeTranscript = await prisma.voiceTranscript.findFirst({
    where: { callId, workspaceId, provider: { in: ["voice_v3_livekit", "livekit"] } },
    select: { id: true },
  });
  if (nativeTranscript) {
    const existingSegments = await prisma.voiceTranscriptSegment.count({
      where: { transcriptId: nativeTranscript.id },
    });
    if (existingSegments > 0) {
      return { materialized: false, turnCount: 0 };
    }
  }

  const call = await prisma.voiceCall.findFirst({
    where: { id: callId },
    select: { metadata: true, workspaceId: true },
  });
  if (!call || call.workspaceId !== workspaceId) {
    return { materialized: false, turnCount: 0 };
  }
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const forensics = (meta[FORENSICS_META_KEY] || {}) as Record<string, unknown>;
  const turns = Array.isArray(forensics.canonicalTurns)
    ? (forensics.canonicalTurns as VoiceV3CanonicalTurn[])
    : [];
  if (!turns.length) {
    return { materialized: false, turnCount: 0 };
  }

  await upsertTranscriptSegments({ workspaceId, callId, turns });
  return { materialized: true, turnCount: turns.length };
}
