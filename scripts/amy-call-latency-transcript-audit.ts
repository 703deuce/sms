/**
 * Audit recent Amy calls: latency (end-of-speech → agent audio) and in/out transcripts.
 * Usage: npx tsx scripts/amy-call-latency-transcript-audit.ts [callId]
 */
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const CALL_ID = process.argv[2]?.trim();

type TurnRow = {
  index: number;
  speaker: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  gapToNextMs: number | null;
  note?: string;
};

function asMs(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function analyzeSegmentGaps(segments: TurnRow[]): TurnRow[] {
  const sorted = [...segments].sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (cur.endMs != null && next.startMs != null && cur.speaker !== next.speaker) {
      cur.gapToNextMs = next.startMs - cur.endMs;
      if (cur.speaker === "caller" && next.speaker === "agent") {
        cur.note = `caller end → agent start: ${cur.gapToNextMs}ms`;
      }
    }
  }
  return sorted;
}

async function fetchTelnyxConversationMessages(conversationId: string) {
  try {
    const res = await telnyxRequest<{ data?: unknown[] }>(
      `/ai/conversations/${conversationId}/messages`,
    );
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

async function main() {
  const prisma = getPrisma();
  const call = CALL_ID
    ? await prisma.voiceCall.findUnique({ where: { id: CALL_ID } })
    : await prisma.voiceCall.findFirst({
        where: { agentId: AGENT_ID, toE164: "+18663464256" },
        orderBy: { startedAt: "desc" },
      });

  if (!call) {
    console.log("No call found");
    return;
  }

  const transcripts = await prisma.voiceTranscript.findMany({
    where: { callId: call.id },
    include: { segments: { orderBy: { startMs: "asc" } } },
  });

  const toolExecutions = await prisma.voiceToolExecution.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
  });

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      workspaceId: call.workspaceId,
      createdAt: { gte: new Date(call.startedAt.getTime() - 60_000) },
    },
    orderBy: { createdAt: "asc" },
    take: 80,
  }).then((rows) =>
    rows.filter((w) => {
      const p = (w.payload || {}) as Record<string, unknown>;
      return (
        p.callId === call.id ||
        p.call_id === call.id ||
        String(p.callControlId || "").includes(call.telnyxCallControlId || "___")
      );
    }),
  );

  console.log("=== Call ===");
  console.log(
    JSON.stringify(
      {
        id: call.id,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        status: call.status,
        from: call.fromE164,
        to: call.toE164,
        telnyxConversationId: call.telnyxConversationId,
        telnyxCallControlId: call.telnyxCallControlId,
      },
      null,
      2,
    ),
  );

  const segmentRows: TurnRow[] = [];
  for (const tr of transcripts) {
    console.log(`\n=== Transcript ${tr.id} (${tr.status}) ===`);
    if (tr.fullText) {
      console.log("fullText:\n", tr.fullText.slice(0, 4000));
    }
    for (const seg of tr.segments) {
      const row: TurnRow = {
        index: segmentRows.length,
        speaker: seg.speaker,
        text: seg.text,
        startMs: seg.startMs,
        endMs: seg.endMs,
        gapToNextMs: null,
      };
      segmentRows.push(row);
      console.log(
        `  [${seg.speaker}] ${seg.startMs ?? "?"}-${seg.endMs ?? "?"}ms (${seg.confidence ?? "?"}) ${seg.text}`,
      );
    }
  }

  const gaps = analyzeSegmentGaps(segmentRows).filter((r) => r.note);
  if (gaps.length) {
    console.log("\n=== Caller end → agent start gaps (from transcript segments) ===");
    for (const g of gaps) {
      console.log(`  ${g.gapToNextMs}ms after: "${g.text.slice(0, 80)}"`);
    }
    const vals = gaps.map((g) => g.gapToNextMs).filter((v): v is number => v != null);
    if (vals.length) {
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      console.log(`  summary: min=${min}ms avg=${avg}ms max=${max}ms n=${vals.length}`);
    }
  } else {
    console.log("\n(no timed transcript segments for gap analysis)");
  }

  console.log("\n=== runtime_turn / tool executions ===");
  for (const t of toolExecutions) {
    const inp = (t.input || {}) as Record<string, unknown>;
    const out = (t.output || {}) as Record<string, unknown>;
    const toolName =
      String(inp.tool || inp.tool_name || inp.name || t.toolId || "unknown");
    if (!/runtime|continue|record_current/i.test(toolName) && !inp.caller_utterance) {
      continue;
    }
    console.log(
      JSON.stringify(
        {
          at: t.createdAt,
          tool: toolName,
          latencyMs: t.latencyMs,
          status: t.status,
          heard:
            inp.caller_utterance ||
            inp.utterance ||
            inp.transcript ||
            inp.user_message ||
            null,
          said:
            out.spoken_response ||
            out.response ||
            out.assistant_message ||
            out.message ||
            null,
          error: t.errorMessage || null,
        },
        null,
        2,
      ),
    );
  }

  if (call.telnyxConversationId) {
    console.log("\n=== Telnyx conversation messages ===");
    const messages = await fetchTelnyxConversationMessages(call.telnyxConversationId);
    for (const m of messages.slice(0, 40)) {
      const row = m as Record<string, unknown>;
      console.log(
        JSON.stringify({
          role: row.role,
          created_at: row.created_at,
          content: String(row.content || row.text || "").slice(0, 300),
        }),
      );
    }
  }

  console.log("\n=== Recent provider webhook events (sample) ===");
  for (const w of webhooks.slice(0, 20)) {
    const p = (w.payload || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        at: w.createdAt,
        eventType: w.eventType,
        tool: p.tool || p.tool_name,
        latencyMs: p.latencyMs || p.latency_ms,
      }),
    );
  }

  // Assistant timing config snapshot
  const agent = await prisma.voiceAgent.findUnique({ where: { id: AGENT_ID } });
  if (agent?.telnyxAssistantId) {
    const remote = await ai.getAssistant(agent.telnyxAssistantId);
    const data = ((remote as { data?: Record<string, unknown> }).data ||
      remote) as Record<string, unknown>;
    const interruption = (data.interruption_settings || {}) as Record<string, unknown>;
    const transcription = (data.transcription || {}) as Record<string, unknown>;
    const startPlan = (interruption.start_speaking_plan || {}) as Record<string, unknown>;
    console.log("\n=== Live assistant timing (current config) ===");
    console.log(
      JSON.stringify(
        {
          model: data.model,
          transcription_model: transcription.model,
          transcription_settings: transcription.settings,
          wait_seconds: startPlan.wait_seconds,
          transcription_endpointing_plan: startPlan.transcription_endpointing_plan,
          user_idle_reply_secs: (data.telephony_settings as Record<string, unknown>)
            ?.user_idle_reply_secs,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
