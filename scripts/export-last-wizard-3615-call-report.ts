#!/usr/bin/env npx tsx
/**
 * Full copy-paste report for the most recent PSTN call to wizard test DID (+15714073615).
 *
 *   WORKSPACE_ID=ws_1 TO_E164=+15714073615 \
 *     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/export-last-wizard-3615-call-report.ts
 *
 * Optional: CALL_ID=... to pin a specific call.
 */
import { writeFileSync } from "node:fs";
import { getPrisma } from "../src/lib/db";

const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
const toE164 = process.env.TO_E164?.trim() || "+15714073615";
const agentId = process.env.AGENT_ID?.trim() || "cmu42zyel1c4x01090c6s335z";
const callIdEnv = process.env.CALL_ID?.trim();
const outPath =
  process.env.OUT_PATH?.trim() || "/opt/cursor/artifacts/voice-v3-last-call-full-report.txt";

type ForensicsEvent = {
  kind?: string;
  occurred_at_utc?: string;
  monotonic_ms_from_call_start?: number;
  source?: string;
  detail?: Record<string, unknown>;
};

type CanonicalTurn = {
  role?: string;
  text?: string;
  startedAtMs?: number;
  endedAtMs?: number;
};

type ExecutionTraceRow = {
  at?: string;
  kind?: string;
  detail?: Record<string, unknown>;
};

function formatExecutionTrace(trace: ExecutionTraceRow[]): string[] {
  const out: string[] = [];
  for (const row of trace) {
    const d = row.detail ?? {};
    const parts: string[] = [];
    if (typeof d.transcriptPreview === "string") parts.push(`caller: "${d.transcriptPreview}"`);
    if (typeof d.text === "string") parts.push(`text: "${d.text}"`);
    if (typeof d.phase === "string") parts.push(`phase=${d.phase}`);
    if (d.userTurnNumber != null) parts.push(`userTurn=${d.userTurnNumber}`);
    if (d.turnNumber != null) parts.push(`turn=${d.turnNumber}`);
    if (d.latencyMs != null) parts.push(`latencyMs=${d.latencyMs}`);
    if (d.tool_type) parts.push(`tool=${d.tool_type}`);
    if (d.function_name) parts.push(`fn=${d.function_name}`);
    out.push(`${row.at ?? "?"} | ${row.kind ?? "?"} | ${parts.join(" | ") || JSON.stringify(d)}`);
  }
  return out;
}

function linesForEvents(events: ForensicsEvent[], kinds?: RegExp): string[] {
  const filtered = kinds
    ? events.filter((e) => kinds.test(String(e.kind ?? "")))
    : events;
  return filtered.map((e) => {
    const d = e.detail ?? {};
    const text =
      typeof d.text === "string"
        ? d.text
        : typeof d.transcript === "string"
          ? d.transcript
          : "";
    const extra = [
      d.function_name ? `fn=${d.function_name}` : "",
      d.tool_name ? `tool=${d.tool_name}` : "",
      d.delegation_id ? `dlg=${d.delegation_id}` : "",
      d.client_event_type ? `client=${d.client_event_type}` : "",
      d.elapsed_ms != null ? `elapsed_ms=${d.elapsed_ms}` : "",
      d.missingFields ? `missing=${JSON.stringify(d.missingFields)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `${e.occurred_at_utc ?? "?"} | +${e.monotonic_ms_from_call_start ?? "?"}ms | ${e.kind ?? "?"} | ${text}${extra ? ` | ${extra}` : ""}`;
  });
}

async function main() {
  const prisma = getPrisma();

  if (process.env.LIST_RECENT === "1") {
    const calls = await prisma.voiceCall.findMany({
      where: {
        workspaceId,
        ...(toE164 ? { toE164 } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: 25,
      select: {
        id: true,
        agentId: true,
        fromE164: true,
        toE164: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        status: true,
      },
    });
    console.log(JSON.stringify(calls, null, 2));
    return;
  }

  const call = callIdEnv
    ? await prisma.voiceCall.findFirst({
        where: { id: callIdEnv, workspaceId },
      })
    : await prisma.voiceCall.findFirst({
        where: {
          workspaceId,
          toE164,
          NOT: { status: "IN_PROGRESS" },
        },
        orderBy: { startedAt: "desc" },
      }) ??
      await prisma.voiceCall.findFirst({
        where: { workspaceId, toE164 },
        orderBy: { startedAt: "desc" },
      });

  if (!call) {
    const recent = await prisma.voiceCall.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        toE164: true,
        fromE164: true,
        startedAt: true,
        agentId: true,
      },
    });
    console.error("NO_CALL_FOUND", { workspaceId, toE164, agentId, recent });
    process.exit(2);
  }

  const agent = call.agentId
    ? await prisma.voiceAgent.findFirst({
        where: { id: call.agentId, workspaceId },
        select: { id: true, name: true, publishedVersionId: true },
      })
    : null;

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const forensics = (meta.voiceV3Forensics || {}) as Record<string, unknown>;
  const events = (Array.isArray(forensics.events) ? forensics.events : []) as ForensicsEvent[];
  const canonicalTurns = (
    Array.isArray(forensics.canonicalTurns) ? forensics.canonicalTurns : []
  ) as CanonicalTurn[];

  const transcripts = await prisma.voiceTranscript.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
  });

  const segmentsByTranscript = await Promise.all(
    transcripts.map(async (t) => ({
      transcript: t,
      segments: await prisma.voiceTranscriptSegment.findMany({
        where: { transcriptId: t.id },
        orderBy: { startMs: "asc" },
      }),
    })),
  );

  const callEvents = await prisma.voiceCallEvent.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const toolExecs = await prisma.voiceToolExecution.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { tool: { select: { name: true } } },
  });

  const recordings = await prisma.voiceRecording.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "desc" },
  });

  const lines: string[] = [];
  lines.push("=".repeat(80));
  lines.push("VOICE V3 — LAST CALL FULL REPORT (copy-paste)");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("=".repeat(80));
  lines.push("");
  lines.push("## Call record");
  lines.push(`Call ID: ${call.id}`);
  lines.push(`Workspace: ${call.workspaceId}`);
  lines.push(`Agent ID: ${call.agentId ?? "(none)"}`);
  lines.push(`Agent name: ${agent?.name ?? "(unknown)"}`);
  lines.push(`Published version: ${agent?.publishedVersionId ?? call.agentVersionId ?? "(unknown)"}`);
  lines.push(`Direction: ${call.direction}`);
  lines.push(`Status: ${call.status}`);
  lines.push(`Outcome: ${call.outcome ?? "(none)"}`);
  lines.push(`From (caller): ${call.fromE164}`);
  lines.push(`To (business/DID): ${call.toE164}`);
  lines.push(`Started: ${call.startedAt.toISOString()}`);
  lines.push(`Ended: ${call.endedAt?.toISOString() ?? "(in progress or missing)"}`);
  lines.push(`Duration (seconds): ${call.durationSeconds ?? "(null)"}`);
  lines.push(`Appointment booked: ${call.appointmentBooked}`);
  lines.push(`Transferred: ${call.transferred}`);
  lines.push(`Telnyx call control: ${call.telnyxCallControlId ?? "(none)"}`);
  lines.push(`Telnyx conversation: ${call.telnyxConversationId ?? "(none)"}`);
  lines.push(`Live session: ${String(meta.liveSessionId ?? meta.live_session_id ?? "(none)")}`);
  lines.push(`GPT Live session: ${String(forensics.gptLiveSessionId ?? "(none)")}`);
  lines.push(`Room / job: ${String(meta.livekitRoomName ?? meta.roomName ?? "(none)")}`);
  lines.push(`Agent template: ${String((meta.realtorAgentConfig as { templateId?: string })?.templateId ?? meta.agentTemplate ?? "(unknown)")}`);
  lines.push("");
  lines.push("## NOTE ON TRANSCRIPTS");
  lines.push(
    "This call used livekit_voice_runtime executionTrace (not voiceV3Forensics canonicalTurns).",
  );
  lines.push(
    "User speech appears as user_turn.transcriptPreview. Agent spoken text is often NOT stored verbatim in executionTrace — only turn timing metrics.",
  );
  lines.push("");
  lines.push("## Recording");
  if (recordings.length === 0) {
    lines.push("(no voice_recording rows)");
  } else {
    for (const r of recordings) {
      lines.push(
        `- id=${r.id} status=${r.status} provider=${r.provider} duration=${r.durationSeconds}s channels=${r.channels}`,
      );
    }
  }
  lines.push("");
  lines.push("## Conversation transcript (canonical turns — forensics)");
  if (canonicalTurns.length === 0) {
    lines.push("(no canonicalTurns in voiceV3Forensics)");
  } else {
    for (const [i, t] of canonicalTurns.entries()) {
      const role = (t.role ?? "unknown").toUpperCase();
      lines.push(`[${i + 1}] ${role}: ${(t.text ?? "").trim()}`);
    }
  }
  lines.push("");
  lines.push("## Stored transcript segments (database)");
  if (segmentsByTranscript.every((x) => x.segments.length === 0)) {
    for (const { transcript: t } of segmentsByTranscript) {
      if (t.fullText?.trim()) {
        lines.push(`--- provider=${t.provider} status=${t.status} (fullText) ---`);
        lines.push(t.fullText.trim());
      }
    }
    if (segmentsByTranscript.every((x) => !x.transcript.fullText?.trim())) {
      lines.push("(no segments or fullText)");
    }
  } else {
    for (const { transcript: t, segments } of segmentsByTranscript) {
      lines.push(`--- Transcript ${t.id} provider=${t.provider} status=${t.status} ---`);
      for (const s of segments) {
        const who = s.speaker ?? "unknown";
        lines.push(
          `[${s.startMs ?? "?"}-${s.endMs ?? "?"}ms] ${who}: ${(s.text ?? "").trim()}`,
        );
      }
    }
  }
  lines.push("");
  lines.push("## Utterance timeline (forensics: caller + agent committed)");
  const utteranceKinds = /^(CALLER_UTTERANCE_COMMITTED|AGENT_TURN_COMMITTED|AGENT_SPEECH_|USER_SPEECH_)/;
  const utterLines = linesForEvents(
    [...events].sort(
      (a, b) => (a.monotonic_ms_from_call_start ?? 0) - (b.monotonic_ms_from_call_start ?? 0),
    ),
    utteranceKinds,
  );
  lines.push(...(utterLines.length ? utterLines : ["(no matching utterance events)"]));
  lines.push("");
  lines.push("## Delegation & tools (forensics)");
  const delegLines = linesForEvents(
    [...events].sort(
      (a, b) => (a.monotonic_ms_from_call_start ?? 0) - (b.monotonic_ms_from_call_start ?? 0),
    ),
    /^(GPT_LIVE_DELEGATION_|FUNCTION_TOOL_|NODE_TOOL_|BACKEND_LLM_)/,
  );
  lines.push(...(delegLines.length ? delegLines : ["(no delegation/tool forensics events)"]));
  lines.push("");
  lines.push("## voice_tool_execution rows");
  if (toolExecs.length === 0) {
    lines.push("(none)");
  } else {
    for (const e of toolExecs) {
      lines.push(
        `${e.createdAt.toISOString()} | ${e.tool?.name ?? "(tool)"} | status=${e.status} | ${e.errorMessage ?? ""}`,
      );
    }
  }
  lines.push("");
  lines.push("## voice_call_event (first 200)");
  for (const e of callEvents) {
    const payloadPreview =
      e.payload && typeof e.payload === "object"
        ? JSON.stringify(e.payload).slice(0, 400)
        : "";
    lines.push(`${e.createdAt.toISOString()} | ${e.eventType}${payloadPreview ? ` | ${payloadPreview}` : ""}`);
  }
  lines.push("");
  lines.push("## Forensics final summary (if present)");
  lines.push(JSON.stringify(forensics.final ?? null, null, 2));
  lines.push("");
  lines.push("## Metadata keys (reference)");
  lines.push(Object.keys(meta).sort().join(", "));
  const executionTrace = Array.isArray(meta.executionTrace)
    ? (meta.executionTrace as ExecutionTraceRow[])
    : [];
  if (executionTrace.length > 0) {
    lines.push("## Call timeline (executionTrace — chronological)");
    lines.push(...formatExecutionTrace(executionTrace));
    lines.push("");
    lines.push("## Reconstructed dialogue (user lines from trace only)");
    let turn = 0;
    for (const row of executionTrace) {
      if (row.kind === "user_turn" && typeof row.detail?.transcriptPreview === "string") {
        turn += 1;
        lines.push(`Caller [turn ${turn}]: ${row.detail.transcriptPreview}`);
      }
    }
    if (turn === 0) lines.push("(no user_turn rows in executionTrace)");
    lines.push("");
    lines.push("## executionTrace (raw JSON)");
    lines.push(JSON.stringify(executionTrace, null, 2));
  }
  if (meta.livekitCallMetrics) {
    lines.push("");
    lines.push("## livekitCallMetrics (metadata)");
    lines.push(JSON.stringify(meta.livekitCallMetrics, null, 2));
  }
  if (events.length > 0) {
    lines.push("");
    lines.push("## All forensics events (raw JSON — truncated per event text)");
    for (const e of [...events].sort(
      (a, b) => (a.monotonic_ms_from_call_start ?? 0) - (b.monotonic_ms_from_call_start ?? 0),
    )) {
      const copy = { ...e };
      if (copy.detail && typeof copy.detail.text === "string" && copy.detail.text.length > 500) {
        copy.detail = { ...copy.detail, text: `${copy.detail.text.slice(0, 500)}…` };
      }
      lines.push(JSON.stringify(copy));
    }
  }
  lines.push("");
  lines.push("=".repeat(80));
  lines.push("END OF REPORT");
  lines.push("=".repeat(80));

  const body = lines.join("\n");
  writeFileSync(outPath, body, "utf8");
  console.log(body);
  console.error(`\nWrote ${outPath} (${body.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
