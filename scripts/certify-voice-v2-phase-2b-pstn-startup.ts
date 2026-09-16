#!/usr/bin/env npx tsx
/**
 * Narrow PSTN startup certification for Phase 2B (call startup only).
 *
 * Reads VoiceCall + VoiceCallEvent rows for one or two calls (before/after deploy).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   CALL_ID=<uuid> [BASELINE_CALL_ID=<uuid>] [NOISE_MS=150] \
 *   npx tsx scripts/certify-voice-v2-phase-2b-pstn-startup.ts
 */
import { getPrisma } from "../src/lib/db";

type Payload = Record<string, unknown>;

function atMs(payload: Payload | null | undefined, fallback?: Date | null): number | null {
  if (!payload) return fallback ? fallback.getTime() : null;
  const at = payload.at;
  if (typeof at === "number") return at;
  if (typeof at === "string") {
    const n = Date.parse(at);
    return Number.isFinite(n) ? n : null;
  }
  return fallback ? fallback.getTime() : null;
}

async function metricsForCall(callId: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) {
    return { ok: false as const, reason: "call_not_found", callId };
  }

  const events = await prisma.voiceCallEvent.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
  });

  const ingressAt = call.createdAt.getTime();

  const answerEv = events.find((e) => e.eventType === "media.answer_sent");
  const aiEv = events.find((e) => e.eventType === "media.ai_assistant_start");
  const maskEnd = events.find((e) => e.eventType === "media.startup_greeting_mask_ended");
  const warmupScheduled = events.find((e) => e.eventType === "voice_v2.warmup_scheduled");
  const warmupStart = events.find((e) => e.eventType === "voice_v2.warmup_started");
  const warmupL2 = events.find((e) => e.eventType === "voice_v2.warmup_l2_ready");

  const answerAt = atMs(answerEv?.payload as Payload, call.answeredAt);
  const aiAt = atMs(aiEv?.payload as Payload);
  const greetingAudioAt = atMs(maskEnd?.payload as Payload) ?? aiAt;

  const pstnIngressToAnswerMs =
    answerAt != null && ingressAt != null ? answerAt - ingressAt : null;
  const answerToGreetingMs =
    answerAt != null && greetingAudioAt != null ? greetingAudioAt - answerAt : null;

  const aiPayload = (aiEv?.payload as Payload) ?? {};
  const assistantStartReturnedAt =
    (typeof aiPayload.ASSISTANT_START_RETURNED_AT === "number"
      ? aiPayload.ASSISTANT_START_RETURNED_AT
      : null) ?? aiAt;

  const schedPayload = (warmupScheduled?.payload as Payload) ?? {};
  const startPayload = (warmupStart?.payload as Payload) ?? {};
  const l2Payload = (warmupL2?.payload as Payload) ?? {};

  const warmupScheduledAt =
    (typeof schedPayload.WARMUP_SCHEDULED_AT === "number"
      ? schedPayload.WARMUP_SCHEDULED_AT
      : null) ?? atMs(schedPayload);
  const warmupStartedAt =
    (typeof startPayload.WARMUP_ACTUAL_STARTED_AT === "number"
      ? startPayload.WARMUP_ACTUAL_STARTED_AT
      : null) ?? atMs(startPayload);
  const warmupL2ReadyAt =
    (typeof l2Payload.WARMUP_L2_READY_AT === "number"
      ? l2Payload.WARMUP_L2_READY_AT
      : null) ?? atMs(l2Payload);

  const assistantReleaseToWarmupStartMs =
    assistantStartReturnedAt != null && warmupStartedAt != null
      ? warmupStartedAt - assistantStartReturnedAt
      : typeof startPayload.ASSISTANT_RELEASE_TO_WARMUP_START_MS === "number"
        ? startPayload.ASSISTANT_RELEASE_TO_WARMUP_START_MS
        : null;

  const warmupDurationMs =
    typeof l2Payload.WARMUP_DURATION_MS === "number"
      ? l2Payload.WARMUP_DURATION_MS
      : warmupStartedAt != null && warmupL2ReadyAt != null
        ? warmupL2ReadyAt - warmupStartedAt
        : null;

  const greetingBeforeWarmup =
    warmupStartedAt != null && assistantStartReturnedAt != null
      ? assistantStartReturnedAt <= warmupStartedAt
      : null;

  const warmupScheduledBeforeRecording =
    warmupScheduledAt != null && assistantStartReturnedAt != null
      ? warmupScheduledAt - assistantStartReturnedAt < 50
      : null;

  return {
    ok: true as const,
    callId,
    path: (aiEv?.payload as Payload)?.path ?? null,
    PSTN_INGRESS_TO_ANSWER_MS: pstnIngressToAnswerMs,
    ANSWER_TO_FIRST_GREETING_AUDIO_MS: answerToGreetingMs,
    ASSISTANT_START_RETURNED_AT: assistantStartReturnedAt,
    WARMUP_SCHEDULED_AT: warmupScheduledAt,
    WARMUP_STARTED_AT: warmupStartedAt,
    WARMUP_L2_READY_AT: warmupL2ReadyAt,
    ASSISTANT_RELEASE_TO_WARMUP_START_MS: assistantReleaseToWarmupStartMs,
    WARMUP_DURATION_MS: warmupDurationMs,
    GREETING_BEFORE_WARMUP: greetingBeforeWarmup,
    WARMUP_SCHEDULED_AFTER_ASSISTANT_RELEASE: warmupScheduledBeforeRecording,
    AI_ASSISTANT_START_AT: aiAt,
  };
}

function regression(before: number | null, after: number | null, noiseMs: number): string {
  if (before == null || after == null) return "UNKNOWN";
  const delta = after - before;
  if (Math.abs(delta) <= noiseMs) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

async function main() {
  const callId = process.env.CALL_ID?.trim();
  const baselineId = process.env.BASELINE_CALL_ID?.trim();
  const noiseMs = Number(process.env.NOISE_MS || "150");

  if (!callId) {
    console.error("CALL_ID required (VoiceCall uuid from a narrow PSTN startup test call)");
    process.exit(1);
  }

  const after = await metricsForCall(callId);
  if (!after.ok) {
    console.error(JSON.stringify(after, null, 2));
    process.exit(1);
  }

  let before: Awaited<ReturnType<typeof metricsForCall>> | null = null;
  if (baselineId) {
    before = await metricsForCall(baselineId);
  }

  const out = {
    PHASE_2B_PSTN_STARTUP: "REPORT",
    AFTER: after,
    BEFORE: before && before.ok ? before : null,
    ANSWER_LATENCY_REGRESSION:
      before && before.ok
        ? regression(before.PSTN_INGRESS_TO_ANSWER_MS, after.PSTN_INGRESS_TO_ANSWER_MS, noiseMs)
        : "PENDING_BASELINE_CALL_ID",
    GREETING_LATENCY_REGRESSION:
      before && before.ok
        ? regression(
            before.ANSWER_TO_FIRST_GREETING_AUDIO_MS,
            after.ANSWER_TO_FIRST_GREETING_AUDIO_MS,
            noiseMs,
          )
        : "PENDING_BASELINE_CALL_ID",
    note:
      "ANSWER_TO_FIRST_GREETING_AUDIO_MS uses media.startup_greeting_mask_ended when present, else media.ai_assistant_start (greeting API handoff).",
  };

  console.log(JSON.stringify(out, null, 2));

  if (after.GREETING_BEFORE_WARMUP === false) {
    console.error("FAIL: warmup started before greeting handoff");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
