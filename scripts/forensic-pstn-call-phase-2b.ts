#!/usr/bin/env npx tsx
/**
 * PSTN call forensic + Phase 2B cert fields (read-only).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   CONV_ID=... [CALL_ID=...] npx tsx scripts/forensic-pstn-call-phase-2b.ts
 */
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { getPrisma } from "../src/lib/db";

const CONV_ID = process.env.CONV_ID?.trim();
const CALL_ID = process.env.CALL_ID?.trim();

type Payload = Record<string, unknown>;

function atMs(payload: Payload | null | undefined, fallback?: Date | null): number | null {
  if (!payload) return fallback ? fallback.getTime() : null;
  const at = payload.at ?? payload.AT;
  if (typeof at === "number") return at;
  if (typeof at === "string") {
    const n = Date.parse(at);
    return Number.isFinite(n) ? n : null;
  }
  return fallback ? fallback.getTime() : null;
}

async function loadMessages(convId: string) {
  const msgs = await ai.listConversationMessages(convId, {});
  const mdata = (msgs as { data?: unknown[] }).data || [];
  return (Array.isArray(mdata) ? mdata : []).sort((a, b) => {
    const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
    const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
    return ta - tb;
  }) as Record<string, unknown>[];
}

async function main() {
  const prisma = getPrisma();
  let convId = CONV_ID;
  let call = CALL_ID
    ? await prisma.voiceCall.findUnique({ where: { id: CALL_ID } })
    : null;

  if (!convId && call?.telnyxConversationId) convId = call.telnyxConversationId;

  if (!convId) {
    console.error("CONV_ID or CALL_ID required");
    process.exit(1);
  }

  const conv = await ai.getConversation(convId).catch(() => null);
  const meta = ((conv as { data?: Record<string, unknown> })?.data?.metadata ||
    (conv as Record<string, unknown>)?.metadata ||
    {}) as Record<string, unknown>;

  if (!call) {
    const cc = String(meta.call_control_id || "");
    call = await prisma.voiceCall.findFirst({
      where: {
        OR: [
          { telnyxConversationId: convId },
          cc ? { telnyxCallControlId: cc } : { id: "___none___" },
        ],
      },
      orderBy: { startedAt: "desc" },
    });
  }

  const messages = await loadMessages(convId);
  const transcriptionEvents = call
    ? await prisma.voiceCallEvent.findMany({
        where: { callId: call.id, eventType: "call.transcription" },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const pstnTranscriptLines = transcriptionEvents
    .map((e) => {
      const td = (e.payload as Payload)?.transcription_data as Payload | undefined;
      const text = td?.transcript;
      if (!text) return null;
      return {
        at: e.createdAt.toISOString(),
        track: td?.transcription_track,
        text: String(text),
      };
    })
    .filter(Boolean);

  const intakeAudits = call
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: call.workspaceId,
          event: "voice_v2.intake_save_trace",
          createdAt: {
            gte: call.startedAt || new Date(0),
            lte: call.endedAt || new Date(),
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const events = call
    ? await prisma.voiceCallEvent.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const tools = call
    ? await prisma.voiceToolExecution.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const ingress = call
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: call.workspaceId,
          event: "voice.tool_webhook.ingress",
          createdAt: {
            gte: call.startedAt || new Date(Date.now() - 3600000),
            lte: call.endedAt || new Date(),
          },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      })
    : [];

  const answerEv = events.find((e) => e.eventType === "media.answer_sent");
  const aiEv = events.find((e) => e.eventType === "media.ai_assistant_start");
  const schedEv = events.find((e) => e.eventType === "voice_v2.warmup_scheduled");
  const warmupStart = events.find((e) => e.eventType === "voice_v2.warmup_started");
  const warmupL2 = events.find((e) => e.eventType === "voice_v2.warmup_l2_ready");

  const aiPayload = (aiEv?.payload as Payload) ?? {};
  const assistantStartReturnedAt =
    (typeof aiPayload.ASSISTANT_START_RETURNED_AT === "number"
      ? aiPayload.ASSISTANT_START_RETURNED_AT
      : null) ?? atMs(aiPayload);

  const schedPayload = (schedEv?.payload as Payload) ?? {};
  const startPayload = (warmupStart?.payload as Payload) ?? {};
  const l2Payload = (warmupL2?.payload as Payload) ?? {};

  const warmupScheduledAt = atMs(schedPayload) ?? (schedPayload.WARMUP_SCHEDULED_AT as number);
  const warmupActualStartedAt =
    (startPayload.WARMUP_ACTUAL_STARTED_AT as number) ?? atMs(startPayload);
  const warmupL2ReadyAt = (l2Payload.WARMUP_L2_READY_AT as number) ?? atMs(l2Payload);

  const ingressAt = call?.createdAt?.getTime() ?? null;
  const answerAt = atMs(answerEv?.payload as Payload, call?.answeredAt);

  const firstTool = tools[0];
  const firstToolAt = firstTool?.createdAt?.getTime() ?? null;

  const turns: unknown[] = [];
  let turn = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = String(msg.role);
    const at = String(msg.created_at);
    const atMsVal = new Date(at).getTime();
    const content = String(msg.content || msg.text || "").trim();

    if (role !== "user") continue;
    turn += 1;
    let nextAssistantAt: number | null = null;
    let toolCalls: unknown = null;
    let toolResults: Array<{ at: number; content: string }> = [];
    for (let j = i + 1; j < messages.length; j++) {
      const m = messages[j];
      const r = String(m.role);
      const t = new Date(String(m.created_at)).getTime();
      if (r === "user") break;
      if (r === "assistant" && m.tool_calls) {
        toolCalls = m.tool_calls;
        continue;
      }
      if (r === "tool") {
        toolResults.push({ at: t, content: String(m.content || "").slice(0, 200) });
        continue;
      }
      if (r === "assistant" && !m.tool_calls) {
        nextAssistantAt = t;
        break;
      }
    }
    const gap =
      nextAssistantAt != null ? nextAssistantAt - atMsVal : null;

    turns.push({
      turn,
      CALLER_TEXT: content,
      USER_MESSAGE_COMMITTED_AT: at,
      AMY_FIRST_AUDIO_AT: nextAssistantAt ? new Date(nextAssistantAt).toISOString() : "UNKNOWN",
      TOTAL_CALLER_STOP_TO_AMY_AUDIO_MS: gap,
      TOOL_CALLS: toolCalls,
      TOOL_RESULTS: toolResults,
      NOTE: "USER_MESSAGE_COMMITTED_AT is Telnyx message created_at, not packet-level caller audio end",
    });
  }

  console.log(
    JSON.stringify(
      {
        CALL_IDENTITY: {
          callId: call?.id ?? "NOT_IN_DB",
          callControlId: meta.call_control_id ?? call?.telnyxCallControlId,
          conversationId: convId,
          workspaceId: call?.workspaceId,
          agentId: call?.agentId,
          startedAt: call?.startedAt?.toISOString(),
          endedAt: call?.endedAt?.toISOString(),
        },
        PHASE_2B_STARTUP: {
          PSTN_INGRESS_TO_ANSWER_MS:
            ingressAt != null && answerAt != null ? answerAt - ingressAt : "UNKNOWN",
          ANSWER_TO_FIRST_GREETING_AUDIO_MS:
            answerAt != null && assistantStartReturnedAt != null
              ? assistantStartReturnedAt - answerAt
              : "UNKNOWN",
          ASSISTANT_START_RETURNED_AT: assistantStartReturnedAt,
          WARMUP_SCHEDULED_AT: warmupScheduledAt,
          WARMUP_ACTUAL_STARTED_AT: warmupActualStartedAt,
          WARMUP_L2_READY_AT: warmupL2ReadyAt,
          ASSISTANT_RELEASE_TO_WARMUP_START_MS:
            assistantStartReturnedAt != null && warmupActualStartedAt != null
              ? warmupActualStartedAt - assistantStartReturnedAt
              : startPayload.ASSISTANT_RELEASE_TO_WARMUP_START_MS ?? "UNKNOWN",
          WARMUP_DURATION_MS: l2Payload.WARMUP_DURATION_MS ?? "UNKNOWN",
          FIRST_REAL_TOOL_AT: firstToolAt ? new Date(firstToolAt).toISOString() : "NONE",
          FIRST_TOOL_CONTEXT_LOOKUP_MS: "UNKNOWN_WITHOUT_TOOL_TRACE",
          FIRST_TOOL_L1_HIT: tools.length ? "UNKNOWN_WITHOUT_METRICS" : "N/A_NO_TOOLS",
          WARMUP_READY_BEFORE_FIRST_TOOL:
            warmupL2ReadyAt != null && firstToolAt != null
              ? warmupL2ReadyAt < firstToolAt
              : tools.length === 0
                ? "N/A_NO_TOOLS"
                : "UNKNOWN",
        },
        TOOL_EXECUTIONS: tools.map((t) => ({
          at: t.createdAt.toISOString(),
          status: t.status,
          latencyMs: t.latencyMs,
          input: t.input,
          error: t.errorMessage,
        })),
        TOOL_WEBHOOK_INGRESS_COUNT: ingress.length,
        VOICE_CALL_EVENTS: events.map((e) => ({
          at: e.createdAt.toISOString(),
          type: e.eventType,
          payload: e.payload,
        })),
        PSTN_TIME_AUTHORITY: {
          rule:
            "Prefer call.transcription + tool/audit ingress over Telnyx Messages API created_at when they conflict.",
          transcription_timeline: pstnTranscriptLines,
          intake_save_audits: intakeAudits.map((a) => ({
            at: a.createdAt.toISOString(),
            detail: a.detail?.slice(0, 400),
          })),
        },
        TURN_TIMELINE: turns,
        TRANSCRIPT_RAW: messages.map((m) => ({
          at: m.created_at,
          role: m.role,
          type: m.type,
          content: String(m.content || m.text || "").slice(0, 300),
          tool_calls: m.tool_calls ?? undefined,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
