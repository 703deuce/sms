#!/usr/bin/env tsx
/**
 * Tool + backend forensics report (no transcript segment timestamps).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getPrisma } from "../src/lib/db";

const suffix = process.argv[2]?.trim() ?? "vcrbyQoJ7aLi";
const outPath =
  process.argv[3]?.trim() ??
  `docs/VOICE-V3-LAST-CALL-TOOL-CHAIN-${suffix}.md`;

type ForensicsEvent = {
  kind: string;
  occurred_at_utc?: string;
  monotonic_ms_from_call_start?: number;
  source?: string;
  detail?: Record<string, unknown>;
};

function dedupeKey(e: ForensicsEvent): string {
  const d = e.detail ?? {};
  return [
    e.kind,
    e.monotonic_ms_from_call_start,
    e.source,
    d.tool_name ?? d.tool,
    d.function_call_id,
    d.status,
    d.elapsed_ms,
  ].join("|");
}

function msLabel(ms: number | undefined): string {
  if (ms == null) return "—";
  const sec = (ms / 1000).toFixed(3);
  return `${ms} ms (+${sec}s from call start)`;
}

const TOOL_KINDS = new Set([
  "FUNCTION_TOOL_STARTED",
  "FUNCTION_TOOL_COMPLETED",
  "NODE_TOOL_EXECUTION_STARTED",
  "NODE_TOOL_EXECUTION_COMPLETED",
  "VOICE_TOOL_REQUESTED",
  "VOICE_TOOL_VALIDATED",
  "VOICE_TOOL_EXECUTION_STARTED",
  "VOICE_TOOL_EXECUTION_SUCCEEDED",
  "VOICE_TOOL_EXECUTION_FAILED",
  "BACKEND_LLM_METRICS_COLLECTED",
  "ASYNC_ACTION_ENQUEUED",
  "ASYNC_ACTION_SUCCEEDED",
  "ASYNC_ACTION_FAILED",
  "BOOKING_COMMIT_SENT",
  "MICROSOFT_EVENT_CREATED",
  "BOOKING_CONFIRMED",
  "FIND_AVAILABILITY_STARTED",
  "FIND_AVAILABILITY_COMPLETED",
  "LIVE_BOOKING_CONFIRMATION_SENT",
]);

const PHASE_MARKERS = new Set([
  "CALLER_UTTERANCE_COMMITTED",
  "AGENT_TURN_COMMITTED",
]);

const DELEGATION_KINDS = new Set([
  "GPT_LIVE_DELEGATION_TELEMETRY_ATTACHED",
  "GPT_LIVE_BACKEND_DELEGATION_CREATED",
  "GPT_LIVE_BACKEND_RESPONSE_CREATED",
  "GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED",
  "GPT_LIVE_BACKEND_RESPONSE_COMPLETED",
  "GPT_LIVE_BACKEND_RESPONSE_FAILED",
  "GPT_LIVE_BACKEND_RESPONSE_INCOMPLETE",
  "GPT_LIVE_BACKEND_CONTINUATION_QUEUED",
  "GPT_LIVE_DELEGATION_RESPONSE_CREATED",
  "GPT_LIVE_DELEGATION_FUNCTION_CALL_EMITTED",
  "GPT_LIVE_DELEGATION_RESPONSE_COMPLETED",
  "GPT_LIVE_DELEGATION_RESPONSE_FAILED",
  "GPT_LIVE_DELEGATION_RESPONSE_INCOMPLETE",
  "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED",
  "GPT_LIVE_DELEGATION_RESPONSE_CREATE",
]);

const RESPONSE_CREATED_KINDS = new Set([
  "GPT_LIVE_BACKEND_RESPONSE_CREATED",
  "GPT_LIVE_DELEGATION_RESPONSE_CREATED",
]);
const FUNCTION_CALL_EMITTED_KINDS = new Set([
  "GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED",
  "GPT_LIVE_DELEGATION_FUNCTION_CALL_EMITTED",
]);
const RESPONSE_COMPLETED_KINDS = new Set([
  "GPT_LIVE_BACKEND_RESPONSE_COMPLETED",
  "GPT_LIVE_DELEGATION_RESPONSE_COMPLETED",
]);
const TOOL_RESULT_QUEUED_KINDS = new Set([
  "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED",
]);
const CONTINUATION_QUEUED_KINDS = new Set([
  "GPT_LIVE_BACKEND_CONTINUATION_QUEUED",
  "GPT_LIVE_DELEGATION_RESPONSE_CREATE",
]);

function eventWallUtc(e: ForensicsEvent): string {
  if (typeof e.occurred_at_utc === "string" && e.occurred_at_utc.includes("T")) {
    return e.occurred_at_utc;
  }
  const ms = (e.detail as { occurred_at_ms?: number })?.occurred_at_ms;
  if (typeof ms === "number") return new Date(ms).toISOString();
  return "";
}

function msBetweenUtc(a: string, b: string): string {
  if (!a || !b) return "N/A";
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return "N/A";
  return String(db - da);
}

type DelegationResponseRow = {
  responseId: string;
  delegationId: string;
  createdUtc: string;
  functionCallEmittedUtc: string;
  callId: string;
  toolName: string;
  functionToolStartUtc: string;
  functionToolEndUtc: string;
  toolResultQueuedUtc: string;
  continuationCreateUtc: string;
  completedUtc: string;
  metricsCompletedUtc: string;
  nextCreatedObservedUtc: string;
};

function eventUtcMs(e: ForensicsEvent): number {
  const wall = eventWallUtc(e);
  if (!wall) return Number.NaN;
  const t = Date.parse(wall);
  return Number.isNaN(t) ? Number.NaN : t;
}

function pickNextAfterUtc<T extends ForensicsEvent>(
  pool: T[],
  afterUtc: string,
  predicate: (e: T) => boolean,
): T | undefined {
  const afterMs = Date.parse(afterUtc);
  if (Number.isNaN(afterMs)) return pool.find(predicate);
  let best: T | undefined;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const e of pool) {
    if (!predicate(e)) continue;
    const ms = eventUtcMs(e);
    if (Number.isNaN(ms) || ms < afterMs) continue;
    if (ms < bestMs) {
      bestMs = ms;
      best = e;
    }
  }
  return best;
}

function buildDelegationResponseRows(events: ForensicsEvent[]): DelegationResponseRow[] {
  const delegationEvents = events
    .filter((e) => DELEGATION_KINDS.has(e.kind))
    .sort((a, b) => eventUtcMs(a) - eventUtcMs(b));
  const toolStarts = events.filter((e) => e.kind === "FUNCTION_TOOL_STARTED");
  const toolEnds = events.filter((e) => e.kind === "FUNCTION_TOOL_COMPLETED");
  const metricsDone = events.filter((e) => e.kind === "BACKEND_LLM_METRICS_COLLECTED");

  const created = delegationEvents.filter((e) => RESPONSE_CREATED_KINDS.has(e.kind));
  const rows: DelegationResponseRow[] = [];
  const usedEmitted = new Set<ForensicsEvent>();
  const usedContinuations = new Set<ForensicsEvent>();

  for (let i = 0; i < created.length; i++) {
    const c = created[i];
    const d = c.detail ?? {};
    const responseId = String(d.response_id ?? "");
    if (!responseId) continue;
    const createdUtc = eventWallUtc(c);
    const delegationId = String(d.delegation_id ?? "unassigned");

    const nextCreatedUtc =
      i + 1 < created.length ? eventWallUtc(created[i + 1]) : "";

    const emittedCandidates = delegationEvents.filter(
      (e) =>
        FUNCTION_CALL_EMITTED_KINDS.has(e.kind) &&
        !usedEmitted.has(e) &&
        String((e.detail ?? {}).delegation_id ?? "unassigned") === delegationId &&
        eventUtcMs(e) >= eventUtcMs(c) &&
        (!nextCreatedUtc || eventUtcMs(e) < Date.parse(nextCreatedUtc)),
    );
    let emitted = emittedCandidates.find(
      (e) => String((e.detail ?? {}).response_id ?? "") === responseId,
    );
    if (!emitted && emittedCandidates.length === 1) {
      emitted = emittedCandidates[0];
    }
    if (!emitted && emittedCandidates.length > 0) {
      emitted = emittedCandidates[0];
    }
    if (emitted) usedEmitted.add(emitted);

    const callId = emitted ? String((emitted.detail ?? {}).call_id ?? "") : "";
    const toolName = emitted ? String((emitted.detail ?? {}).function_name ?? "") : "";
    const functionCallEmittedUtc = emitted ? eventWallUtc(emitted) : "";

    const fnStart = callId
      ? toolStarts.find((e) => String((e.detail ?? {}).call_id ?? "") === callId)
      : undefined;
    const fnEnd = callId
      ? toolEnds.find((e) => String((e.detail ?? {}).call_id ?? "") === callId)
      : undefined;
    const functionToolStartUtc = fnStart ? eventWallUtc(fnStart) : "";
    const functionToolEndUtc = fnEnd ? eventWallUtc(fnEnd) : "";

    const toolResult = callId
      ? pickNextAfterUtc(
          delegationEvents.filter((e) => TOOL_RESULT_QUEUED_KINDS.has(e.kind)),
          functionToolEndUtc || functionCallEmittedUtc || createdUtc,
          (e) => String((e.detail ?? {}).call_id ?? "") === callId,
        )
      : undefined;
    const toolResultQueuedUtc = toolResult ? eventWallUtc(toolResult) : "";

    const continuation = pickNextAfterUtc(
      delegationEvents.filter(
        (e) => CONTINUATION_QUEUED_KINDS.has(e.kind) && !usedContinuations.has(e),
      ),
      toolResultQueuedUtc || functionToolEndUtc || createdUtc,
      () => true,
    );
    if (continuation) usedContinuations.add(continuation);
    const continuationCreateUtc = continuation ? eventWallUtc(continuation) : "";

    const nextCreated = i + 1 < created.length ? created[i + 1] : undefined;
    const nextCreatedObservedUtc = nextCreated ? eventWallUtc(nextCreated) : "";

    const completed = delegationEvents.find(
      (e) =>
        RESPONSE_COMPLETED_KINDS.has(e.kind) &&
        String((e.detail ?? {}).response_id ?? "") === responseId,
    );
    const completedUtc = completed ? eventWallUtc(completed) : "";

    const metrics = metricsDone.find((e) => {
      const rid = String((e.detail ?? {}).request_id ?? (e.detail ?? {}).response_id ?? "");
      return rid === responseId;
    });
    const metricsCompletedUtc = metrics ? eventWallUtc(metrics) : "";

    rows.push({
      responseId,
      delegationId,
      createdUtc,
      functionCallEmittedUtc,
      callId,
      toolName,
      functionToolStartUtc,
      functionToolEndUtc,
      toolResultQueuedUtc,
      continuationCreateUtc,
      completedUtc,
      metricsCompletedUtc,
      nextCreatedObservedUtc,
    });
  }
  return rows;
}

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: { contains: suffix } },
    select: { id: true, startedAt: true, endedAt: true, metadata: true, appointmentBooked: true },
  });
  if (!call) throw new Error(`No call matching ${suffix}`);

  const redactPhones = (s: string) =>
    s.replace(/\+1\d{10}/g, "+1[REDACTED]").replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[REDACTED]");

  const safeCallId = redactPhones(call.id);

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const forensics = meta.voiceV3Forensics as {
    events?: ForensicsEvent[];
    callerTurns?: unknown[];
    gptLiveSessionId?: string;
    liveSessionId?: string;
  };

  const raw = forensics?.events ?? [];
  const seen = new Set<string>();
  const events: ForensicsEvent[] = [];
  for (const e of raw) {
    const k = dedupeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    events.push(e);
  }
  events.sort(
    (a, b) =>
      (a.monotonic_ms_from_call_start ?? 0) - (b.monotonic_ms_from_call_start ?? 0),
  );

  const toolEvents = events.filter((e) => TOOL_KINDS.has(e.kind));
  const markers = events.filter((e) => PHASE_MARKERS.has(e.kind));

  // Info-dump phase: last caller utterance mentioning Harriet / mom before scheduling question
  const dumpEndMarker = markers
    .filter((e) => e.kind === "CALLER_UTTERANCE_COMMITTED")
    .filter((e) => {
      const t = String((e.detail as { text?: string })?.text ?? "").toLowerCase();
      return t.includes("harriet") || t.includes("yahoo");
    })
    .pop();

  const schedulingQuestion = markers
    .filter((e) => e.kind === "AGENT_TURN_COMMITTED")
    .find((e) => {
      const t = String((e.detail as { text?: string })?.text ?? "").toLowerCase();
      return t.includes("day and time") || t.includes("what day");
    });

  const dumpEndMs = dumpEndMarker?.monotonic_ms_from_call_start ?? null;
  const schedQMs = schedulingQuestion?.monotonic_ms_from_call_start ?? null;

  const callStartMs = call.startedAt?.getTime() ?? 0;
  const monoToUtc = (mono: number) =>
    callStartMs ? new Date(callStartMs + mono).toISOString() : "—";

  const lines: string[] = [];
  const reportBase = outPath.replace(/\.md$/i, "");
  const reportDir = dirname(outPath);
  const reportBaseName = reportBase.slice(reportDir.length + 1);
  const eventsJsonName = `${reportBaseName}.events.json`;
  const backendJsonName = `${reportBaseName}.backend-events.json`;
  const eventsJsonPath = join(reportDir, eventsJsonName);
  const backendJsonPath = join(reportDir, backendJsonName);

  lines.push(`# Voice V3 — tool & backend chain (last call)`);
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Files (click on GitHub to open)");
  lines.push("");
  lines.push("| Artifact | Link |");
  lines.push("|----------|------|");
  lines.push(`| Summary (this page) | [\`${reportBaseName}.md\`](./${reportBaseName}.md) |`);
  lines.push(
    `| Tool events JSON blob | [\`${eventsJsonName}\`](./${eventsJsonName}) |`,
  );
  lines.push(
    `| All backend/tool forensics JSON | [\`${backendJsonName}\`](./${backendJsonName}) |`,
  );
  lines.push("");
  lines.push(
    "> On GitHub: open the `.json` files from the repo tree (syntax-highlighted), or use **Raw** on that file to copy/download the full blob.",
  );
  lines.push("");
  lines.push(`**Room suffix:** \`${suffix}\``);
  lines.push(`**Call id:** \`${safeCallId}\``);
  lines.push(`**Wall clock:** ${call.startedAt?.toISOString()} → ${call.endedAt?.toISOString()}`);
  lines.push(`**GPT-Live session:** ${forensics?.gptLiveSessionId ?? "—"}`);
  lines.push(`**appointmentBooked flag:** ${call.appointmentBooked}`);
  lines.push("");
  lines.push("> This report lists **tool and backend events only**. It does **not** include per-line transcript timestamps.");
  lines.push("");

  lines.push("## Phase: after info-dump → until scheduling question");
  lines.push("");
  const fmtUtc = (e: ForensicsEvent | undefined) => {
    const u = e?.occurred_at_utc;
    if (typeof u === "string" && u.includes("T")) return u;
    const ms = (e?.detail as { occurred_at_ms?: number })?.occurred_at_ms;
    if (typeof ms === "number") return new Date(ms).toISOString();
    return "—";
  };

  if (dumpEndMarker) {
    const mono = dumpEndMarker.monotonic_ms_from_call_start ?? 0;
    lines.push(
      `- **Info-dump end (caller utterance committed — Harriet/yahoo marker, no per-line transcript log):** monotonic ${msLabel(dumpEndMarker.monotonic_ms_from_call_start)} · wall **${monoToUtc(mono)}**`,
    );
  } else {
    lines.push("- Info-dump end marker: not found in forensics (Harriet/yahoo utterance).");
  }
  if (schedulingQuestion) {
    const mono = schedulingQuestion.monotonic_ms_from_call_start ?? 0;
    lines.push(
      `- **Amy asks day/time (agent turn committed — content omitted here):** monotonic ${msLabel(schedulingQuestion.monotonic_ms_from_call_start)} · wall **${monoToUtc(mono)}**`,
    );
  }
  if (dumpEndMs != null && schedQMs != null) {
    lines.push(`- **Gap (monotonic):** ${schedQMs - dumpEndMs} ms between those two markers.`);
  }
  lines.push("");

  const windowEvents = events.filter((e) => {
    const ms = e.monotonic_ms_from_call_start ?? 0;
    if (dumpEndMs == null || schedQMs == null) return false;
    return ms >= dumpEndMs && ms <= schedQMs && (TOOL_KINDS.has(e.kind) || e.kind.includes("TOOL"));
  });

  lines.push(`### Tool/backend events in that window (${windowEvents.length})`);
  lines.push("");
  if (windowEvents.length === 0) {
    lines.push("_No tool executions logged between info-dump end and scheduling question — model may have been thinking/speaking without tools._");
  } else {
    for (const e of windowEvents) {
      lines.push(formatEvent(e));
    }
  }
  lines.push("");

  lines.push("## Tool order (summary)");
  lines.push("");
  lines.push("1. **`update_intake`** — after info-dump (intake persisted on Node).");
  lines.push("2. *(caller answers day/time — no tools)*");
  lines.push("3. **`set_scheduling_preference`** — preference captured.");
  lines.push("4. **`find_availability`** — Microsoft calendar query (~1.5 s Node).");
  lines.push("5. *(offer slot, caller confirms)*");
  lines.push("6. **`book_appointment`** — Microsoft Graph create (~1.6 s Node) → **`confirmed`**.");
  lines.push("");
  lines.push("### Microsoft book pipeline (web runtime logs, same call)");
  lines.push("");
  lines.push("| Wall UTC (approx) | Event | Notes |");
  lines.push("|-------------------|-------|-------|");
  lines.push("| `2026-09-21T13:06:19.330Z` | `BOOKING_COMMIT_SENT` | `provider: microsoft` |");
  lines.push("| `2026-09-21T13:06:20.027Z` | `ASYNC_ACTION_SUCCEEDED` | `BOOK_APPOINTMENT`, `bka_cmub9e14x0d6m243i4m201q6g` |");
  lines.push("| `2026-09-21T13:06:20.961Z` | `MICROSOFT_EVENT_CREATED` | Graph create **810 ms** |");
  lines.push("| `2026-09-21T13:06:20.962Z` | `BOOKING_CONFIRMED` | `offer_set_b76853bdd0ca`, `slot_1` |");
  lines.push("");
  lines.push("*(Pulled from Coolify web container during earlier forensics; current container log buffer may have rotated.)*");
  lines.push("");

  lines.push("## Full tool chain (deduped, call order)");
  lines.push("");
  lines.push("| # | Monotonic | Wall UTC | Source | Kind | Detail |");
  lines.push("|---|-----------|----------|--------|------|--------|");
  let n = 0;
  const toolOnly = events.filter(
    (e) =>
      TOOL_KINDS.has(e.kind) ||
      e.kind.includes("TOOL") ||
      e.kind.startsWith("BOOKING") ||
      e.kind.startsWith("FIND_") ||
      e.kind.startsWith("MICROSOFT"),
  );
  for (const e of toolOnly) {
    n++;
    const d = e.detail ?? {};
    const detailStr = JSON.stringify(d).slice(0, 500);
    const mono = e.monotonic_ms_from_call_start ?? 0;
    const wall = mono ? monoToUtc(mono) : fmtUtc(e);
    lines.push(
      `| ${n} | ${e.monotonic_ms_from_call_start ?? ""} | ${wall} | ${e.source ?? ""} | ${e.kind} | \`${detailStr}\` |`,
    );
  }
  lines.push("");

  // Pair FUNCTION_TOOL started/completed for latency table
  lines.push("## Per-tool latency (worker `FUNCTION_TOOL_*` pairs)");
  lines.push("");
  const started = new Map<string, ForensicsEvent>();
  const pairs: {
    tool: string;
    fcId: string;
    startMs: number;
    endMs: number;
    durationMs: number;
    status: string;
    startUtc: string;
    endUtc: string;
  }[] = [];

  for (const e of events) {
    const d = e.detail ?? {};
    if (e.kind === "FUNCTION_TOOL_STARTED") {
      const fc = String(d.function_call_id ?? d.fc_id ?? "");
      started.set(fc, e);
    }
    if (e.kind === "FUNCTION_TOOL_COMPLETED") {
      const fc = String(d.function_call_id ?? d.fc_id ?? "");
      const s = started.get(fc);
      if (s && s.monotonic_ms_from_call_start != null && e.monotonic_ms_from_call_start != null) {
        pairs.push({
          tool: String(d.tool ?? d.tool_name ?? ""),
          fcId: fc,
          startMs: s.monotonic_ms_from_call_start,
          endMs: e.monotonic_ms_from_call_start,
          durationMs: e.monotonic_ms_from_call_start - s.monotonic_ms_from_call_start,
          status: String(d.status ?? ""),
          startUtc: monoToUtc(s.monotonic_ms_from_call_start),
          endUtc: monoToUtc(e.monotonic_ms_from_call_start),
        });
      }
    }
  }

  lines.push("| Order | Tool | function_call_id | Start (mono) | End (mono) | Duration | Status | Start UTC | End UTC |");
  lines.push("|-------|------|------------------|--------------|------------|----------|--------|-----------|---------|");
  pairs.sort((a, b) => a.startMs - b.startMs);
  pairs.forEach((p, i) => {
    lines.push(
      `| ${i + 1} | ${p.tool} | \`${p.fcId.slice(0, 24)}…\` | ${p.startMs} | ${p.endMs} | **${p.durationMs} ms** | ${p.status} | ${p.startUtc} | ${p.endUtc} |`,
    );
  });
  lines.push("");

  // NODE tool pairs
  lines.push("## Node execution timing (`NODE_TOOL_EXECUTION_*`)");
  lines.push("");
  const nodeStart = new Map<string, ForensicsEvent>();
  const nodePairs: { tool: string; durationMs: number; status: string; startUtc: string; endUtc: string }[] =
    [];
  for (const e of events) {
    const d = e.detail ?? {};
    const fc = String(d.function_call_id ?? "");
    if (e.kind === "NODE_TOOL_EXECUTION_STARTED") nodeStart.set(fc, e);
    if (e.kind === "NODE_TOOL_EXECUTION_COMPLETED") {
      const s = nodeStart.get(fc);
      if (s?.monotonic_ms_from_call_start != null && e.monotonic_ms_from_call_start != null) {
        nodePairs.push({
          tool: String(d.tool_name ?? ""),
          durationMs: e.monotonic_ms_from_call_start - s.monotonic_ms_from_call_start,
          status: String(d.status ?? ""),
          startUtc: monoToUtc(s.monotonic_ms_from_call_start),
          endUtc: monoToUtc(e.monotonic_ms_from_call_start),
        });
      }
    }
  }
  for (const p of nodePairs) {
    lines.push(
      `- **${p.tool}** — node slice **${p.durationMs} ms** (${p.status}) · ${p.startUtc} → ${p.endUtc}`,
    );
  }
  lines.push("");

  lines.push("## Backend LLM (delegation) metrics snapshots");
  lines.push("");
  for (const e of events.filter((e) => e.kind === "BACKEND_LLM_METRICS_COLLECTED")) {
    const d = e.detail ?? {};
    lines.push(
      `- ${monoToUtc(e.monotonic_ms_from_call_start ?? 0)} · mono ${e.monotonic_ms_from_call_start} ms · ${JSON.stringify(d).slice(0, 400)}`,
    );
  }
  lines.push("");

  const delegationRows = buildDelegationResponseRows(events);
  lines.push("## GPT-Live → Sol delegation lifecycle (provider events)");
  lines.push("");
  if (!events.some((e) => DELEGATION_KINDS.has(e.kind))) {
    lines.push(
      "_No `GPT_LIVE_DELEGATION_*` events in forensics. Run a call on a voice worker build that includes passive delegation telemetry._",
    );
  } else if (delegationRows.length === 0) {
    lines.push("_Delegation telemetry attached but no `response.created` rows with `response_id` were captured._");
  } else {
    const byDelegation = new Map<string, DelegationResponseRow[]>();
    for (const row of delegationRows) {
      const key = row.delegationId || "unassigned";
      const list = byDelegation.get(key) ?? [];
      list.push(row);
      byDelegation.set(key, list);
    }
    for (const [delegationId, group] of byDelegation.entries()) {
      lines.push(`### DELEGATION \`${delegationId}\``);
      lines.push("");
      for (const [i, row] of group.entries()) {
        lines.push(`#### Response ${i + 1}: \`${row.responseId}\``);
        lines.push("");
        lines.push("| Boundary | UTC |");
        lines.push("|----------|-----|");
        lines.push(`| response.created (observed) | ${row.createdUtc || "N/A"} |`);
        lines.push(`| output_item.done (function_call) | ${row.functionCallEmittedUtc || "N/A"} |`);
        lines.push(`| call_id / tool | \`${row.callId || "N/A"}\` / ${row.toolName || "N/A"} |`);
        lines.push(`| FUNCTION_TOOL_STARTED | ${row.functionToolStartUtc || "N/A"} |`);
        lines.push(`| FUNCTION_TOOL_COMPLETED | ${row.functionToolEndUtc || "N/A"} |`);
        lines.push(`| response.item.create (tool result queued) | ${row.toolResultQueuedUtc || "N/A"} |`);
        lines.push(`| response.create (continuation) | ${row.continuationCreateUtc || "N/A"} |`);
        lines.push(`| next response.created (observed) | ${row.nextCreatedObservedUtc || "N/A"} |`);
        lines.push(`| response.completed (observed) | ${row.completedUtc || "N/A"} |`);
        lines.push(`| BACKEND_LLM_METRICS (legacy resp complete) | ${row.metricsCompletedUtc || "N/A"} |`);
        lines.push("");
        lines.push("| Interval (UTC cross-process) | ms |");
        lines.push("|----------|-----|");
        lines.push(
          `| backend response created observed → function call emitted | ${msBetweenUtc(row.createdUtc, row.functionCallEmittedUtc)} |`,
        );
        lines.push(
          `| function call emitted → FUNCTION_TOOL_STARTED | ${msBetweenUtc(row.functionCallEmittedUtc, row.functionToolStartUtc)} |`,
        );
        lines.push(
          `| FUNCTION_TOOL duration | ${msBetweenUtc(row.functionToolStartUtc, row.functionToolEndUtc)} |`,
        );
        lines.push(
          `| FUNCTION_TOOL_COMPLETED → tool result queued | ${msBetweenUtc(row.functionToolEndUtc, row.toolResultQueuedUtc)} |`,
        );
        lines.push(
          `| tool result queued → continuation response.create | ${msBetweenUtc(row.toolResultQueuedUtc, row.continuationCreateUtc)} |`,
        );
        lines.push(
          `| continuation response.create → next response.created observed | ${msBetweenUtc(row.continuationCreateUtc, row.nextCreatedObservedUtc)} |`,
        );
        lines.push(
          `| response.created observed → response.completed observed | ${msBetweenUtc(row.createdUtc, row.completedUtc)} |`,
        );
        lines.push("");
      }
      const first = group[0]?.createdUtc;
      const last = group[group.length - 1]?.completedUtc || group[group.length - 1]?.createdUtc;
      lines.push(
        `**Delegation-chain elapsed (first created → last completed):** ${msBetweenUtc(first, last)} ms`,
      );
      lines.push("");
    }
  }
  lines.push("");

  lines.push("## Native LiveKit per-turn latency");
  lines.push("");
  const chatMetrics = events.filter((e) => e.kind === "VOICE_V3_CHAT_MESSAGE_METRICS");
  if (chatMetrics.length === 0) {
    lines.push("_No `VOICE_V3_CHAT_MESSAGE_METRICS` events (upgrade voice worker + place a new call)._");
  } else {
    lines.push("| role | message id | started_speaking_at | stopped_speaking_at | e2e_latency | playback_latency | transcription_delay | end_of_turn_delay | provider_request_ids |");
    lines.push("|------|------------|---------------------|---------------------|-------------|------------------|---------------------|-------------------|----------------------|");
    for (const e of chatMetrics) {
      const d = e.detail ?? {};
      const m = (d.metrics ?? {}) as Record<string, unknown>;
      const fmt = (v: unknown) => (v == null || v === "" ? "N/A" : String(v));
      lines.push(
        `| ${fmt(d.role)} | \`${fmt(d.message_id)}\` | ${fmt(m.started_speaking_at)} | ${fmt(m.stopped_speaking_at)} | ${fmt(m.e2e_latency)} | ${fmt(m.playback_latency)} | ${fmt(m.transcription_delay)} | ${fmt(m.end_of_turn_delay)} | ${fmt(m.provider_request_ids)} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Session usage (LiveKit native)");
  lines.push("");
  const usageEvents = events.filter((e) => e.kind === "SESSION_USAGE_UPDATED");
  const lastUsage = usageEvents[usageEvents.length - 1];
  const sessionUsage = forensics?.sessionUsage;
  if (!lastUsage && !sessionUsage) {
    lines.push("_No session usage captured._");
  } else {
    if (lastUsage) {
      lines.push(`Last \`SESSION_USAGE_UPDATED\` at ${eventWallUtc(lastUsage)}:`);
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify((lastUsage.detail ?? {}).usage ?? {}, null, 2).slice(0, 8000));
      lines.push("```");
      lines.push("");
    }
    if (sessionUsage) {
      lines.push("Final `session.usage` at flush:");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(sessionUsage, null, 2).slice(0, 8000));
      lines.push("```");
    }
  }
  lines.push("");

  const backendRelated = events.filter(
    (e) =>
      TOOL_KINDS.has(e.kind) ||
      DELEGATION_KINDS.has(e.kind) ||
      e.kind.includes("TOOL") ||
      e.kind.startsWith("BOOKING") ||
      e.kind.startsWith("FIND_") ||
      e.kind.startsWith("MICROSOFT") ||
      e.kind === "BACKEND_LLM_METRICS_COLLECTED",
  );

  lines.push("## Raw JSON blobs");
  lines.push("");
  lines.push(
    `Full machine-readable payloads are **not** inlined here (too large for one page). Use the linked files:`,
  );
  lines.push("");
  lines.push(`- [\`${eventsJsonName}\`](./${eventsJsonName}) — ${toolOnly.length} tool-related forensics events`);
  lines.push(
    `- [\`${backendJsonName}\`](./${backendJsonName}) — structured export (${backendRelated.length} backend/tool events, pairs, phase markers)`,
  );
  lines.push("");

  const toolJson = redactPhones(JSON.stringify(toolOnly, null, 2));
  writeFileSync(eventsJsonPath, toolJson + "\n", "utf8");

  const backendBlob = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    callId: safeCallId,
    roomSuffix: suffix,
    callStartedAt: call.startedAt?.toISOString(),
    callEndedAt: call.endedAt?.toISOString(),
    gptLiveSessionId: forensics?.gptLiveSessionId,
    toolPairs: pairs,
    nodePairs,
    phase: {
      infoDumpEndMonotonicMs: dumpEndMarker?.monotonic_ms_from_call_start,
      schedulingQuestionMonotonicMs: schedulingQuestion?.monotonic_ms_from_call_start,
    },
    toolEvents: toolOnly,
    delegationLifecycleRows: delegationRows,
    allBackendRelatedEvents: backendRelated,
  };
  writeFileSync(
    backendJsonPath,
    redactPhones(JSON.stringify(backendBlob, null, 2)) + "\n",
    "utf8",
  );

  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log("Wrote", outPath, eventsJsonPath, backendJsonPath);
  console.log("tool rows:", toolOnly.length, "pairs:", pairs.length);
  const p = getPrisma();
  if (typeof p.$disconnect === "function") await p.$disconnect();
}

function formatEvent(e: ForensicsEvent): string {
  const wall =
    typeof e.occurred_at_utc === "string" && e.occurred_at_utc.includes("T")
      ? e.occurred_at_utc
      : typeof (e.detail as { occurred_at_ms?: number })?.occurred_at_ms === "number"
        ? new Date((e.detail as { occurred_at_ms: number }).occurred_at_ms).toISOString()
        : String(e.occurred_at_utc ?? "—");
  return `- **${e.kind}** · ${wall} · mono ${e.monotonic_ms_from_call_start} ms · ${JSON.stringify(e.detail ?? {})}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
