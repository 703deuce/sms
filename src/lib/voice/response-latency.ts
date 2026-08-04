/**
 * Conversational response latency instrumentation.
 *
 * Principal user-facing metric:
 *   caller finishes speaking → first audible agent audio
 *
 * Do NOT substitute internal LLM completion time for this metric.
 * Stage timestamps help locate delay (STT / LLM / TTS / buffering / init)
 * without changing provider timing defaults.
 */

import { getPrisma } from "@/lib/db";
import {
  SHARED_LATENCY_TARGETS,
  type ResponseLatencyTargets,
} from "@/lib/voice/timing-presets";

/** Per-turn stage timestamps (ms, wall-clock or call-relative). */
export type ResponseLatencyStages = {
  callerTurnEndedAt?: number | null;
  transcriptReadyAt?: number | null;
  llmFirstTokenAt?: number | null;
  ttsFirstAudioReadyAt?: number | null;
  agentFirstAudibleAudioAt?: number | null;
};

export type ResponseLatencyBreakdown = {
  endOfTurnToFirstAudioMs?: number | null;
  sttLatencyMs?: number | null;
  llmFirstTokenLatencyMs?: number | null;
  ttsFirstAudioLatencyMs?: number | null;
};

export type ResponseLatencySample = {
  callerEndOfSpeechAtMs: number;
  firstAgentAudioAtMs: number;
  /** Alias: endOfTurnToFirstAudioMs */
  latencyMs: number;
  stages?: ResponseLatencyStages;
  breakdown?: ResponseLatencyBreakdown;
  /** first_response | conversational | tool | post_transfer */
  category?: "first_response" | "conversational" | "tool" | "post_transfer";
  recordedAt: string;
  source:
    | "transcription_segments"
    | "conversation_messages"
    | "client_timeline"
    | "manual"
    | "pipeline";
};

export type ResponseLatencySummary = {
  sampleCount: number;
  medianMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  meanMs: number | null;
  rating: ResponseLatencyRating;
  targets: ResponseLatencyTargets;
  byCategory?: Partial<
    Record<
      NonNullable<ResponseLatencySample["category"]>,
      { sampleCount: number; p50Ms: number | null; p95Ms: number | null }
    >
  >;
  stageP50?: Partial<Record<keyof ResponseLatencyBreakdown, number | null>>;
  stageP95?: Partial<Record<keyof ResponseLatencyBreakdown, number | null>>;
  metricDefinition: "caller_end_of_speech_to_first_audible_agent_audio";
};

export type ResponseLatencyRating =
  | "excellent"
  | "natural"
  | "usable"
  | "slow"
  | "investigate"
  | "poor"
  | "unknown";

export function classifyResponseLatencyMs(
  latencyMs: number,
  _targets: ResponseLatencyTargets = SHARED_LATENCY_TARGETS,
): ResponseLatencyRating {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return "unknown";
  // Reporting bands for ordinary non-tool Telnyx turns (not artificial delays).
  // Primary goal: p50 under 500 ms. Do not claim success without phone measurements.
  if (latencyMs <= 450) return "excellent";
  if (latencyMs <= 500) return "natural";
  if (latencyMs <= 700) return "usable";
  if (latencyMs <= 1000) return "slow";
  if (latencyMs <= 1500) return "investigate";
  return "poor";
}

export function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx] ?? null;
}

export function breakdownFromStages(
  stages: ResponseLatencyStages,
): ResponseLatencyBreakdown {
  const ended = stages.callerTurnEndedAt ?? null;
  const transcript = stages.transcriptReadyAt ?? null;
  const llm = stages.llmFirstTokenAt ?? null;
  const ttsReady = stages.ttsFirstAudioReadyAt ?? null;
  const audible = stages.agentFirstAudibleAudioAt ?? null;

  const delta = (a: number | null, b: number | null) =>
    a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && b >= a
      ? b - a
      : null;

  return {
    endOfTurnToFirstAudioMs: delta(ended, audible),
    sttLatencyMs: delta(ended, transcript),
    llmFirstTokenLatencyMs: delta(transcript ?? ended, llm),
    ttsFirstAudioLatencyMs: delta(llm ?? transcript ?? ended, ttsReady ?? audible),
  };
}

export function summarizeResponseLatency(
  samples: Array<
    Pick<ResponseLatencySample, "latencyMs" | "category" | "breakdown">
  >,
  targets: ResponseLatencyTargets = SHARED_LATENCY_TARGETS,
): ResponseLatencySummary {
  const values = samples
    .map((s) => s.latencyMs)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  const medianMs = percentile(values, 50);
  const p50Ms = medianMs;
  const p95Ms = percentile(values, 95);
  const meanMs = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
  const rating =
    medianMs == null ? "unknown" : classifyResponseLatencyMs(medianMs, targets);

  const byCategory: ResponseLatencySummary["byCategory"] = {};
  for (const cat of [
    "first_response",
    "conversational",
    "tool",
    "post_transfer",
  ] as const) {
    const catValues = samples
      .filter((s) => s.category === cat)
      .map((s) => s.latencyMs)
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
    if (catValues.length) {
      byCategory[cat] = {
        sampleCount: catValues.length,
        p50Ms: percentile(catValues, 50),
        p95Ms: percentile(catValues, 95),
      };
    }
  }

  const stageKeys: (keyof ResponseLatencyBreakdown)[] = [
    "endOfTurnToFirstAudioMs",
    "sttLatencyMs",
    "llmFirstTokenLatencyMs",
    "ttsFirstAudioLatencyMs",
  ];
  const stageP50: ResponseLatencySummary["stageP50"] = {};
  const stageP95: ResponseLatencySummary["stageP95"] = {};
  for (const key of stageKeys) {
    const vals = samples
      .map((s) => s.breakdown?.[key])
      .filter((n): n is number => typeof n === "number" && n >= 0)
      .sort((a, b) => a - b);
    if (vals.length) {
      stageP50[key] = percentile(vals, 50);
      stageP95[key] = percentile(vals, 95);
    }
  }

  return {
    sampleCount: values.length,
    medianMs,
    p50Ms,
    p95Ms,
    meanMs,
    rating,
    targets,
    byCategory: Object.keys(byCategory).length ? byCategory : undefined,
    stageP50: Object.keys(stageP50).length ? stageP50 : undefined,
    stageP95: Object.keys(stageP95).length ? stageP95 : undefined,
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
  let turnIndex = 0;

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
        const stages: ResponseLatencyStages = {
          callerTurnEndedAt: pendingCallerEnd,
          agentFirstAudibleAudioAt: start,
        };
        samples.push({
          callerEndOfSpeechAtMs: pendingCallerEnd,
          firstAgentAudioAtMs: start,
          latencyMs,
          stages,
          breakdown: breakdownFromStages(stages),
          category: turnIndex === 0 ? "first_response" : "conversational",
          recordedAt: new Date().toISOString(),
          source: "transcription_segments",
        });
        turnIndex += 1;
      }
      pendingCallerEnd = null;
    }
  }
  return samples;
}

/**
 * Approximate from conversation message timestamps (user → assistant).
 * Prefer segment-based measurement when available.
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
  let turnIndex = 0;

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
        const stages: ResponseLatencyStages = {
          callerTurnEndedAt: pendingUserAt,
          agentFirstAudibleAudioAt: ts,
        };
        samples.push({
          callerEndOfSpeechAtMs: pendingUserAt,
          firstAgentAudioAtMs: ts,
          latencyMs,
          stages,
          breakdown: breakdownFromStages(stages),
          category: turnIndex === 0 ? "first_response" : "conversational",
          recordedAt: new Date().toISOString(),
          source: "conversation_messages",
        });
        turnIndex += 1;
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
  const summary = summarizeResponseLatency(merged, SHARED_LATENCY_TARGETS);

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prevMeta,
        responseLatency: {
          metricDefinition: summary.metricDefinition,
          note: "Measures caller end-of-speech → first audible agent audio. Not LLM completion time. Bands are reporting guidance only — not artificial delays.",
          targets: SHARED_LATENCY_TARGETS,
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
  });
}

/**
 * Streaming / buffering audit checklist for pipeline reviews.
 * Does not change runtime behavior — used by tests and diagnostics.
 */
export const STREAMING_PIPELINE_AUDIT = {
  expectStreamingStt: true,
  expectStreamingLlm: true,
  expectStreamingTts: true,
  expectImmediateChunkPlayback: true,
  antiPatterns: [
    "wait_for_full_transcript_before_llm",
    "wait_for_complete_llm_response_before_tts",
    "wait_for_complete_tts_file_before_playback",
    "excessive_audio_buffering",
    "late_agent_session_init_after_first_caller_turn",
  ],
} as const;
