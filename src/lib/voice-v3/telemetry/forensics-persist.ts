import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { getCallerTurns } from "../conversation/caller-turn-manager";
import { exportAllCallerTurnTimingForSession } from "./caller-turn-timing";
import type { VoiceV3CanonicalTurn, VoiceV3ForensicEvent } from "./call-forensics";

const FORENSICS_META_KEY = "voiceV3Forensics";
const SCHEMA_VERSION = 1;
const MAX_STORED_EVENTS = 4_000;

export type VoiceV3ForensicsPersistInput = {
  callId: string;
  liveSessionId: string;
  workspaceId: string;
  agentId: string;
  events: VoiceV3ForensicEvent[];
  canonicalTurns: VoiceV3CanonicalTurn[];
  final: boolean;
  reason: string;
  callerTurns?: unknown[];
  callerTurnTiming?: unknown[];
  sessionHistory?: unknown;
  sessionReport?: unknown;
  gptLiveUsage?: unknown;
  backendLlmUsage?: unknown;
  gptLiveSessionId?: string | null;
  liveKitJobId?: string | null;
  roomName?: string | null;
};

function mergeEvents(
  prev: VoiceV3ForensicEvent[],
  incoming: VoiceV3ForensicEvent[],
): VoiceV3ForensicEvent[] {
  const byKey = new Map<string, VoiceV3ForensicEvent>();
  const keyOf = (e: VoiceV3ForensicEvent) =>
    `${e.kind}|${e.occurred_at_utc}|${e.monotonic_ms_from_call_start ?? ""}|${JSON.stringify(e.detail ?? {})}`;
  for (const e of prev) {
    byKey.set(keyOf(e), e);
  }
  for (const e of incoming) {
    byKey.set(keyOf(e), e);
  }
  const merged = [...byKey.values()].sort((a, b) => {
    const am = a.monotonic_ms_from_call_start ?? a.occurred_at_ms ?? 0;
    const bm = b.monotonic_ms_from_call_start ?? b.occurred_at_ms ?? 0;
    return am - bm;
  });
  if (merged.length > MAX_STORED_EVENTS) {
    return merged.slice(merged.length - MAX_STORED_EVENTS);
  }
  return merged;
}

async function upsertTranscriptSegments(input: {
  workspaceId: string;
  callId: string;
  turns: VoiceV3CanonicalTurn[];
}): Promise<void> {
  if (!input.turns.length) return;
  const prisma = getPrisma();
  const existing = await prisma.voiceTranscript.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  const fullText = input.turns.map((t) => `${t.role}: ${t.text}`).join("\n");
  const transcript =
    existing ??
    (await prisma.voiceTranscript.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        provider: "voice_v3_livekit",
        status: "completed",
        fullText,
      },
      select: { id: true },
    }));

  if (existing) {
    await prisma.voiceTranscript.update({
      where: { id: existing.id },
      data: { fullText, status: "completed", updatedAt: new Date() },
    });
  }

  await prisma.voiceTranscriptSegment.deleteMany({
    where: { transcriptId: transcript.id },
  });

  const segments = input.turns.map((t, idx) => ({
    transcriptId: transcript.id,
    workspaceId: input.workspaceId,
    speaker: t.role === "assistant" ? "agent" : t.role === "user" ? "caller" : "system",
    text: t.text,
    startMs:
      typeof t.speech?.started_speaking_at === "number"
        ? Math.round(Number(t.speech.started_speaking_at) * 1000)
        : idx * 1000,
    endMs:
      typeof t.speech?.stopped_speaking_at === "number"
        ? Math.round(Number(t.speech.stopped_speaking_at) * 1000)
        : idx * 1000 + 500,
    confidence: null as number | null,
  }));

  if (segments.length) {
    await prisma.voiceTranscriptSegment.createMany({ data: segments });
  }
}

export async function buildNodeForensicsAttachments(liveSessionId: string): Promise<{
  callerTurns: unknown[];
  callerTurnTiming: unknown[];
}> {
  return {
    callerTurns: getCallerTurns(liveSessionId),
    callerTurnTiming: exportAllCallerTurnTimingForSession(liveSessionId),
  };
}

export async function persistVoiceV3ForensicsPackage(
  input: VoiceV3ForensicsPersistInput,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { id: true, metadata: true, status: true, endedAt: true },
  });
  if (!call) {
    console.warn("VOICE_V3_FORENSICS_SKIP_NO_CALL", {
      call_id: input.callId,
      live_session_id: input.liveSessionId,
    });
    return;
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const voiceV3 = (meta.voiceV3 || {}) as Record<string, unknown>;
  const prevForensics = (meta[FORENSICS_META_KEY] || {}) as Record<string, unknown>;
  const prevEvents = Array.isArray(prevForensics.events)
    ? (prevForensics.events as VoiceV3ForensicEvent[])
    : [];

  const mergedEvents = mergeEvents(prevEvents, input.events);
  const canonicalTurns =
    input.canonicalTurns.length > 0
      ? input.canonicalTurns
      : (Array.isArray(prevForensics.canonicalTurns)
          ? (prevForensics.canonicalTurns as VoiceV3CanonicalTurn[])
          : []);

  const packageBody: Record<string, unknown> = {
    schemaVersion: SCHEMA_VERSION,
    callId: input.callId,
    liveSessionId: input.liveSessionId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    reason: input.reason,
    final: input.final,
    updatedAt: new Date().toISOString(),
    events: mergedEvents,
    canonicalTurns,
    callerTurns: input.callerTurns ?? prevForensics.callerTurns ?? [],
    callerTurnTiming: input.callerTurnTiming ?? prevForensics.callerTurnTiming ?? [],
    sessionHistory: input.sessionHistory ?? prevForensics.sessionHistory,
    sessionReport: input.sessionReport ?? prevForensics.sessionReport,
    gptLiveUsage: input.gptLiveUsage ?? prevForensics.gptLiveUsage,
    backendLlmUsage: input.backendLlmUsage ?? prevForensics.backendLlmUsage,
    gptLiveSessionId: input.gptLiveSessionId ?? prevForensics.gptLiveSessionId,
    liveKitJobId: input.liveKitJobId ?? prevForensics.liveKitJobId,
    roomName: input.roomName ?? prevForensics.roomName,
  };

  const nextMeta = {
    ...meta,
    voiceV3: {
      ...voiceV3,
      callId: input.callId,
      liveSessionId: input.liveSessionId,
      gptLiveSessionId: packageBody.gptLiveSessionId,
      roomName: input.roomName ?? voiceV3.roomName,
    },
    [FORENSICS_META_KEY]: packageBody,
  };

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: nextMeta as Prisma.InputJsonValue,
      ...(input.final
        ? {
            status: call.status === "COMPLETED" ? call.status : "COMPLETED",
            endedAt: call.endedAt ?? new Date(),
          }
        : {}),
    },
  });

  await upsertTranscriptSegments({
    workspaceId: input.workspaceId,
    callId: input.callId,
    turns: canonicalTurns,
  }).catch((err) => {
    console.warn("VOICE_V3_FORENSICS_TRANSCRIPT_FAILED", {
      call_id: input.callId,
      message: err instanceof Error ? err.message : String(err),
    });
  });

}
