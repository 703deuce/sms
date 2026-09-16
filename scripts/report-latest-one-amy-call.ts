#!/usr/bin/env npx tsx
/**
 * Full one-Amy PSTN call report → stdout + file.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/report-latest-one-amy-call.ts
 */
import { writeFileSync } from "fs";
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const ASSISTANT =
  process.env.TELNYX_ASSISTANT_ID || "assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6";
const OUT = process.env.OUT || "/opt/cursor/artifacts/one-amy-pstn-call-report.md";
const CALL_ID = process.env.CALL_ID?.trim();
const CONV_ID = process.env.CONV_ID?.trim();

type Payload = Record<string, unknown>;
const lines: string[] = [];
function log(s: string) {
  lines.push(s);
  console.log(s);
}

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
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);

  let call = CALL_ID
    ? await prisma.voiceCall.findFirst({ where: { id: CALL_ID, workspaceId: WORKSPACE_ID } })
    : null;

  let convId = CONV_ID || call?.telnyxConversationId || null;

  if (!convId) {
    const listed = await ai.listConversations({});
    const data = (listed as { data?: unknown[] }).data || [];
    const rows = (Array.isArray(data) ? data : [])
      .map((r) => r as Record<string, unknown>)
      .filter((r) => {
        const meta = (r.metadata || {}) as Record<string, unknown>;
        return meta.assistant_id === ASSISTANT;
      })
      .sort((a, b) => {
        const ta = new Date(String(a.created_at)).getTime();
        const tb = new Date(String(b.created_at)).getTime();
        return tb - ta;
      });
    const latest = rows[0];
    if (latest?.id) convId = String(latest.id);
  }

  if (!call && convId) {
    call = await prisma.voiceCall.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        OR: [{ telnyxConversationId: convId }, { agentId: AGENT_ID, startedAt: { gte: since } }],
      },
      orderBy: { startedAt: "desc" },
    });
  }

  if (!call) {
    const fallback = await prisma.voiceCall.findFirst({
      where: { workspaceId: WORKSPACE_ID, agentId: AGENT_ID, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
    });
    call = fallback;
    if (call?.telnyxConversationId) convId = call.telnyxConversationId;
  }

  log(`# One-Amy PSTN call report`);
  log(`Generated: ${new Date().toISOString()}`);
  log("");

  if (!call && !convId) {
    log("No call found in last 2h for agent " + AGENT_ID);
    writeFileSync(OUT, lines.join("\n"));
    return;
  }

  log(`## Identifiers`);
  log(`- VoiceCall id: ${call?.id ?? "—"}`);
  log(`- Telnyx conversation: ${convId ?? "—"}`);
  log(`- Agent: ${AGENT_ID}`);
  log(`- Assistant: ${ASSISTANT}`);
  if (call) {
    log(`- From → To: ${call.fromE164 ?? "?"} → ${call.toE164 ?? "?"}`);
    log(`- Started: ${call.startedAt?.toISOString() ?? "?"}`);
    log(`- Ended: ${call.endedAt?.toISOString() ?? "?"}`);
    log(`- Status: ${call.status}`);
    log(`- Duration (sec): ${call.durationSeconds ?? "?"}`);
  }
  log("");

  const messages = convId ? await loadMessages(convId) : [];

  log(`## Transcript (Telnyx Messages API, chronological)`);
  let firstUserAt: number | null = null;
  let firstAssistantAfterBookingIntent: { at: number; text: string } | null = null;
  let bookingIntentUserAt: number | null = null;
  const toolCallOrder: string[] = [];

  for (const m of messages) {
    const role = String(m.role || "");
    const created = String(m.created_at || "");
    const t = Date.parse(created);
    const content = String(m.content || m.text || "").trim();
    const type = String(m.type || "");

    if (role === "user" && content) {
      if (firstUserAt == null) firstUserAt = t;
      if (/book|appointment|schedule/i.test(content) && bookingIntentUserAt == null) {
        bookingIntentUserAt = t;
      }
    }
    if (
      role === "assistant" &&
      content &&
      bookingIntentUserAt != null &&
      t > bookingIntentUserAt &&
      !firstAssistantAfterBookingIntent
    ) {
      firstAssistantAfterBookingIntent = { at: t, text: content };
    }

    const toolCalls = m.tool_calls as unknown;
    if (toolCalls && Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        const fn = (tc as { function?: { name?: string } }).function?.name;
        if (fn) toolCallOrder.push(`${created} ${fn}`);
      }
    }

    const preview = content.replace(/\n/g, " ").slice(0, 500);
    log(`### ${created} | ${role}${type ? ` (${type})` : ""}`);
    if (preview) log(preview);
    if (toolCalls) log(`tool_calls: ${JSON.stringify(toolCalls).slice(0, 1200)}`);
    if (role === "tool" && content) log(`tool_result: ${content.slice(0, 1500)}`);
    log("");
  }

  log(`## Latency (booking-intent turn)`);
  if (bookingIntentUserAt != null && firstAssistantAfterBookingIntent) {
    const delta = firstAssistantAfterBookingIntent.at - bookingIntentUserAt;
    log(`- Caller booking-intent message at: ${new Date(bookingIntentUserAt).toISOString()}`);
    log(`- First Amy reply after intent: ${new Date(firstAssistantAfterBookingIntent.at).toISOString()}`);
    log(`- **Approx. caller-stop → first Amy audio (API timestamps): ${delta} ms**`);
    log(`- Amy said: "${firstAssistantAfterBookingIntent.text.slice(0, 200)}"`);
  } else {
    log(`- Could not pair booking-intent utterance with first assistant reply (check transcript).`);
  }
  if (firstUserAt != null && messages.length) {
    const firstAsst = messages.find((m) => String(m.role) === "assistant" && String(m.content || "").trim());
    if (firstAsst) {
      const ta = Date.parse(String(firstAsst.created_at));
      log(`- First user → first Amy (any topic): ${ta - firstUserAt} ms`);
    }
  }
  log("");

  log(`## Tool calls (from transcript tool_calls)`);
  if (toolCallOrder.length) {
    for (const t of toolCallOrder) log(`- ${t}`);
  } else {
    log(`- (none in message stream)`);
  }
  log("");

  const tools = call
    ? await prisma.voiceToolExecution.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  log(`## voiceToolExecution rows (${tools.length})`);
  for (const t of tools) {
    const inp = (t.input || {}) as Payload;
    log(`- ${t.createdAt.toISOString()} | ${inp.toolType || inp.tool_type || "?"} | status=${t.status} | latencyMs=${t.latencyMs ?? "?"}`);
    if (t.errorMessage) log(`  error: ${t.errorMessage.slice(0, 300)}`);
    const out = JSON.stringify(t.output || {}).slice(0, 400);
    if (out.length > 2) log(`  output: ${out}`);
  }
  log("");

  const events = call
    ? await prisma.voiceCallEvent.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const answerEv = events.find((e) => e.eventType === "media.answer_sent");
  const aiEv = events.find((e) => e.eventType === "media.ai_assistant_start");
  const warmupL2 = events.find((e) => e.eventType === "voice_v2.warmup_l2_ready");
  const ingressAt = call?.startedAt?.getTime() ?? null;
  const answerAt = atMs(answerEv?.payload as Payload, call?.answeredAt ?? null);

  log(`## Call startup / warmup events`);
  log(`- PSTN ingress → answer: ${ingressAt && answerAt ? answerAt - ingressAt : "?"} ms`);
  if (warmupL2) log(`- voice_v2.warmup_l2_ready at ${warmupL2.createdAt.toISOString()}`);
  log(`- Event count: ${events.length}`);
  log("");

  const intakeAudits = call
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: WORKSPACE_ID,
          event: { in: ["voice_v2.intake_save_trace", "voice_v2.pstn_tool_trace"] },
          createdAt: {
            gte: call.startedAt || since,
            lte: call.endedAt || new Date(),
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const relevantAudits = intakeAudits.filter((a) =>
    call ? (a.detail || "").includes(call.id) || true : true,
  );

  log(`## V2 audits (${relevantAudits.length})`);
  for (const a of relevantAudits) {
    log(`### ${a.createdAt.toISOString()} ${a.event}`);
    log((a.detail || "").slice(0, 4000));
    log("");
  }

  const ingress = call
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: WORKSPACE_ID,
          event: "voice.tool_webhook.ingress",
          createdAt: {
            gte: call.startedAt || since,
            lte: call.endedAt || new Date(),
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  log(`## Tool webhook ingress (${ingress.length})`);
  for (const a of ingress) {
    log(`${a.createdAt.toISOString()} ${(a.detail || "").slice(0, 500)}`);
  }
  log("");

  const saveOnIntent = toolCallOrder.some((t) =>
    /save_intake|save-intake/i.test(t),
  );
  const findCalls = tools.filter((t) =>
    String((t.input as Payload)?.toolType || "").includes("find"),
  ).length;
  const bookCalls = tools.filter((t) =>
    String((t.input as Payload)?.toolType || "").includes("book"),
  ).length;
  const legacy = tools.filter((t) =>
    String((t.input as Payload)?.toolType || "").includes("voice_ai_booking"),
  ).length;

  log(`## Pass / fail rubric (one-Amy minimum)`);
  log(`| Check | Result |`);
  log(`|-------|--------|`);
  log(`| ONE_AMY (no live_booking handoff in transcript) | ${!/transfer.*book|booking assistant/i.test(lines.join("\n")) ? "likely yes" : "review"} |`);
  log(`| BOOKING_INTENT save_intake in first tools | ${saveOnIntent && bookingIntentUserAt ? "FAIL" : "PASS (none early)"} |`);
  log(`| voice_v2_find_availability executions | ${findCalls} |`);
  log(`| voice_v2_book_offered_slot executions | ${bookCalls} |`);
  log(`| legacy voice_ai_booking_turn | ${legacy} |`);
  log(`| Tool webhook errors | ${tools.filter((t) => t.status === "failed").length} failed |`);

  writeFileSync(OUT, lines.join("\n"));
  log("");
  log(`Report written to: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
