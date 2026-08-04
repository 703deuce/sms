/**
 * Caller end-of-speech → first audible agent audio latency.
 *
 * This is the product response-latency metric. Do NOT use internal LLM
 * completion time as a substitute.
 */

import { getPrisma } from "@/lib/db";
import {
  SHARED_LATENCY_TARGETS,
  type ResponseLatencyTargets,
  getVoiceTimingPreset,
} from "@/lib/voice/timing-presets";

export type ResponseLatencySample = {
  /** Wall-clock or call-relative ms when caller speech ended. */
  callerEndOfSpeechAtMs: number;
  /** Wall-clock or call-relative ms when agent audio first became audible. */
  firstAgentAudioAtMs: number;
  /** Derived: firstAgentAudioAtMs - callerEndOfSpeechAtMs */
  latencyMs: number;
  recordedAt: string;
  source:
    | "transcription_segments"
    | "conversation_messages"
    | "client_timeline"
    | "manual";
};

export type ResponseLatencySummary = {
  sampleCount: number;
  medianMs: number | null;
  p95Ms: number | null;
  meanMs: number | null;
  rating: ResponseLatencyRating;
  targets: ResponseLatencyTargets;
  /** Clarifies that LLM time is excluded from this metric. */
  metricDefinition: "caller_end_of_speech_to_first_audible_agent_audio";
};

export type ResponseLatencyRating =
  | "excellent"
  | "very_good"
  | "good"
  | "usable"
  | "slow"
  | "poor"
  | "critical"
  | "unknown";

export function classifyResponseLatencyMs(
  latencyMs: number,
  targets: ResponseLatencyTargets = SHARED_LATENCY_TARGETS,
): ResponseLatencyRating {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return "unknown";
  if (latencyMs <= 400) return "excellent";
  if (latencyMs <= 600) return "very_good";
  if (latencyMs <= targets.medianAcceptableMs) return "good";
  if (latencyMs <= targets.medianWarningMs) return "usable";
  if (latencyMs <= targets.medianCriticalMs) return "slow";
  if (latencyMs <= targets.p95CriticalMs) return "poor";
  return "critical";
}

export function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx] ?? null;
}

export function summarizeResponseLatency(
  samples: Array<Pick<ResponseLatencySample, "latencyMs">>,
  targets: ResponseLatencyTargets = SHARED_LATENCY_TARGETS,
): ResponseLatencySummary {
  const values = samples
    .map((s) => s.latencyMs)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  const medianMs = percentile(values, 50);
  const p95Ms = percentile(values, 95);
  const meanMs = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
  const rating =
    medianMs == null ? "unknown" : classifyResponseLatencyMs(medianMs, targets);
  return {
    sampleCount: values.length,
    medianMs,
    p95Ms,
    meanMs,
    rating,
    targets,
    metricDefinition: "caller_end_of_speech_to_first_audible_agent_audio",
  };
}

function isInboundSpeaker(speaker: string): boolean {
  const s = speaker.toLowerCase();
  return (
    s.includes("inbound") ||
    s === "user" ||
    s === "caller" ||
    s === "customer" ||
    s.includes("human")
  );
}

function isOutboundSpeaker(speaker: string): boolean {
  const s = speaker.toLowerCase();
  return (
    s.includes("outbound") ||
    s === "assistant" ||
    s === "agent" ||
    s === "ai" ||
    s.includes("bot")
  );
}

/**
 * Derive turn latencies from transcript segment start/end ms.
 * Uses consecutive inbound end → next outbound start gaps.
 */
export function deriveLatencyFromTranscriptSegments(
  segments: Array<{
    speaker?: string | null;
    startMs?: number | null;
    endMs?: number | null;
  }>,
): ResponseLatencySample[] {
  const ordered = [...segments].filter(
    (s) =>
      s.startMs != null &&
      Number.isFinite(s.startMs) &&
      (s.endMs == null || Number.isFinite(s.endMs)),
  );
  ordered.sort((a, b) => Number(a.startMs) - Number(b.startMs));

  const samples: ResponseLatencySample[] = [];
  let pendingCallerEnd: number | null = null;

  for (const seg of ordered) {
    const speaker = String(seg.speaker || "");
    if (isInboundSpeaker(speaker)) {
      const end = seg.endMs != null ? Number(seg.endMs) : Number(seg.startMs);
      if (Number.isFinite(end)) pendingCallerEnd = end;
      continue;
    }
    if (isOutboundSpeaker(speaker) && pendingCallerEnd != null) {
      const start = Number(seg.startMs);
      const latencyMs = start - pendingCallerEnd;
      if (latencyMs >= 0 && latencyMs < 30_000) {
        samples.push({
          callerEndOfSpeechAtMs: pendingCallerEnd,
          firstAgentAudioAtMs: start,
          latencyMs,
          recordedAt: new Date().toISOString(),
          source: "transcription_segments",
        });
      }
      pendingCallerEnd = null;
    }
  }
  return samples;
}

/**
 * Approximate from conversation message timestamps (user → assistant).
 * Prefer segment-based measurement when available — message created_at is
 * not identical to first audible audio but is better than LLM-only timing.
 */
export function deriveLatencyFromConversationMessages(
  messages: Array<{
    role?: string | null;
    createdAt?: Date | string | null;
    metadata?: Record<string, unknown> | null;
  }>,
): ResponseLatencySample[] {
  const samples: ResponseLatencySample[] = [];
  let pendingUserAt: number | null = null;

  for (const m of messages) {
    const role = String(m.role || "").toLowerCase();
    const meta = (m.metadata || {}) as Record<string, unknown>;
    const tsRaw =
      m.createdAt ||
      meta.created_at ||
      meta.sent_at ||
      meta.timestamp ||
      null;
    const ts = tsRaw ? new Date(tsRaw as string | Date).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;

    if (role === "user" || role === "caller" || role === "human") {
      pendingUserAt = ts;
      continue;
    }
    if (
      pendingUserAt != null &&
      (role === "assistant" || role === "agent" || role === "ai")
    ) {
      const latencyMs = ts - pendingUserAt;
      if (latencyMs >= 0 && latencyMs < 30_000) {
        samples.push({
          callerEndOfSpeechAtMs: pendingUserAt,
          firstAgentAudioAtMs: ts,
          latencyMs,
          recordedAt: new Date().toISOString(),
          source: "conversation_messages",
        });
      }
      pendingUserAt = null;
    }
  }
  return samples;
}

const MAX_STORED_SAMPLES = 40;

export async function recordCallResponseLatency(input: {
  callId: string;
  workspaceId: string;
  samples: ResponseLatencySample[];
  presetId?: string | null;
}): Promise<ResponseLatencySummary | null> {
  if (!input.samples.length) return null;
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  if (!call) return null;

  const prevMeta = (call.metadata || {}) as Record<string, unknown>;
  const prevLatency = (prevMeta.responseLatency || {}) as {
    samples?: ResponseLatencySample[];
  };
  const merged = [...(prevLatency.samples || []), ...input.samples].slice(
    -MAX_STORED_SAMPLES,
  );
  const targets = getVoiceTimingPreset(input.presetId).responseLatencyTargets;
  const summary = summarizeResponseLatency(merged, targets);

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prevMeta,
        responseLatency: {
          metricDefinition: summary.metricDefinition,
          note: "Measures caller end-of-speech → first audible agent audio. Not LLM completion time.",
          targets,
          samples: merged,
          summary,
          updatedAt: new Date().toISOString(),
        },
      } as object,
    },
  });

  return summary;
}

/**
 * After a call ends, compute and persist response latency from stored
 * transcript segments (preferred) and/or conversation messages.
 */
export async function captureCallResponseLatency(input: {
  callId: string;
  workspaceId: string;
  presetId?: string | null;
}): Promise<ResponseLatencySummary | null> {
  const prisma = getPrisma();
  const transcript = await prisma.voiceTranscript.findFirst({
    where: { workspaceId: input.workspaceId, callId: input.callId },
    include: { segments: { orderBy: { startMs: "asc" }, take: 500 } },
  });

  let samples: ResponseLatencySample[] = [];
  if (transcript?.segments?.length) {
    samples = deriveLatencyFromTranscriptSegments(
      transcript.segments.map(
        (s: {
          speaker: string;
          startMs: number | null;
          endMs: number | null;
        }) => ({
          speaker: s.speaker,
          startMs: s.startMs,
          endMs: s.endMs,
        }),
      ),
    );
  }

  if (!samples.length) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: { telnyxConversationId: true },
    });
    if (call?.telnyxConversationId) {
      const conv = await prisma.voiceAiConversation.findFirst({
        where: {
          workspaceId: input.workspaceId,
          telnyxConversationId: call.telnyxConversationId,
        },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 200 },
        },
      });
      if (conv?.messages?.length) {
        samples = deriveLatencyFromConversationMessages(
          conv.messages.map(
            (m: {
              role: string;
              createdAt: Date;
              metadata: unknown;
            }) => ({
              role: m.role,
              createdAt: m.createdAt,
              metadata: (m.metadata || null) as Record<string, unknown> | null,
            }),
          ),
        );
      }
    }
  }

  return recordCallResponseLatency({
    callId: input.callId,
    workspaceId: input.workspaceId,
    samples,
    presetId: input.presetId,
  });
}
