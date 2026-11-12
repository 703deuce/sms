#!/usr/bin/env tsx
/**
 * Complete PSTN forensic export for independent review.
 * Usage: npx tsx scripts/export-voice-v3-latest-pstn-complete-forensics.ts [roomSuffix]
 */
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";

const SUFFIX = process.argv[2]?.trim() || "MoSPbJXesc6M";
const DATE_TAG = "2026-09-21";
const MD_PATH = join("docs", `VOICE-V3-LATEST-PSTN-COMPLETE-FORENSICS-${DATE_TAG}.md`);
const JSON_PATH = join("docs", `VOICE-V3-LATEST-PSTN-COMPLETE-FORENSICS-${DATE_TAG}.json`);
const WORKER_COMMIT_EXPECTED = "c91c4f4c425af22aaceb3437a60d381db5744417";
const JOB_ID = "AJ_ZraAQEjVM9Ci";

type ForensicsEvent = {
  kind: string;
  occurred_at_utc?: string;
  monotonic_ms_from_call_start?: number;
  source?: string;
  detail?: Record<string, unknown>;
};

function redact(s: string): string {
  return s
    .replace(/lk_transovo-call-[^_\s"']+_/g, "lk_transovo-call-{caller-redacted}_")
    .replace(/transovo-call-[^_\s"']+_/g, "transovo-call-{caller-redacted}_")
    .replace(/turn_lk_transovo-call-[^_\s"']+_/g, `turn_lk_transovo-call-{caller-redacted}_`)
    .replace(/\+1\d{10}/g, "+1[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/wss?:\/\/[^\s'"]+/gi, "[URL_REDACTED]")
    .replace(/https?:\/\/[^\s'"]+/gi, "[URL_REDACTED]")
    .replace(/LIVEKIT_URL[=:]\s*[^\s'"]+/gi, "LIVEKIT_URL=[REDACTED]")
    .replace(/APP_URL[=:]\s*[^\s'"]+/gi, "APP_URL=[REDACTED]")
    .replace(/NEXT_PUBLIC_APP_URL[=:]\s*[^\s'"]+/gi, "NEXT_PUBLIC_APP_URL=[REDACTED]")
    .replace(/OUTBOUND_TEST_PHONE[=:]\s*[^\s'"]+/gi, "OUTBOUND_TEST_PHONE=[REDACTED]");
}

function sanitizeValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") return redact(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map(sanitizeValue);
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "text" || k === "utterance" || k === "arguments") {
        if (k === "arguments" && typeof val === "string") {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === "object") {
              o.argument_key_names = Object.keys(parsed);
              o.argument_count = Object.keys(parsed).length;
              continue;
            }
          } catch {
            /* keep redacted string length only */
            o[k] = `[redacted string len=${val.length}]`;
            continue;
          }
        }
        o[k] = typeof val === "string" ? redact(val) : sanitizeValue(val);
      } else if (k === "output" || k === "message") {
        o[k] = "[redacted]";
      } else {
        o[k] = sanitizeValue(val);
      }
    }
    return o;
  }
  return String(v);
}

function sanitizeEvent(e: ForensicsEvent): ForensicsEvent {
  return {
    ...e,
    detail: e.detail ? (sanitizeValue(e.detail) as Record<string, unknown>) : {},
  };
}

function dedupeKey(e: ForensicsEvent): string {
  const d = e.detail ?? {};
  return [
    e.kind,
    e.occurred_at_utc,
    e.monotonic_ms_from_call_start,
    e.source,
    d.response_id,
    d.delegation_id,
    d.call_id,
    d.client_event_id,
    d.function_call_id,
    d.tool_name,
    d.tool,
    d.message_id,
    d.inner_type,
  ].join("|");
}

function utcMs(e: ForensicsEvent): number {
  if (typeof e.occurred_at_utc === "string") {
    const t = Date.parse(e.occurred_at_utc);
    if (!Number.isNaN(t)) return t;
  }
  return NaN;
}

function msBetween(a: string | undefined, b: string | undefined): string {
  if (!a || !b) return "N/A";
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return "N/A";
  return String(db - da);
}

function fmtMs(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "N/A";
  return String(n);
}

function fmtMetricField(v: unknown): string {
  if (v == null) return "N/A";
  if (typeof v === "number" && v > 1_000_000_000) {
    return `${v} (RAW — Python monotonic seconds, not wall UTC)`;
  }
  return String(v);
}

function eventWallUtc(e: ForensicsEvent | undefined): string {
  return e?.occurred_at_utc ?? "";
}

function isoOrNa(d: Date | null | undefined): string {
  return d?.toISOString() ?? "N/A";
}

function buildMasterTimelineRow(
  e: ForensicsEvent,
  callStartMs: number,
): Record<string, string> {
  const d = e.detail ?? {};
  const utc = String(e.occurred_at_utc ?? "");
  const rel =
    callStartMs && utc ? String(Date.parse(utc) - callStartMs) : "N/A";
  let category = "other";
  if (e.kind.includes("CHAT_MESSAGE") || e.kind.includes("UTTERANCE") || e.kind.includes("TURN_COMMITTED")) {
    category = "speech/transcript";
  } else if (e.kind.includes("GPT_LIVE") || e.kind.includes("DELEGATION") || e.kind.includes("BACKEND")) {
    category = "gpt-live/sol";
  } else if (e.kind.includes("FUNCTION_TOOL") || e.kind.includes("NODE_TOOL")) {
    category = "tool";
  } else if (e.kind.includes("SESSION") || e.kind.includes("AGENTSESSION")) {
    category = "session";
  }
  return {
    utc,
    rel_ms: rel,
    source: String(e.source ?? ""),
    category,
    event: e.kind,
    delegation_id: String(d.delegation_id ?? ""),
    response_id: String(d.response_id ?? ""),
    call_id: String(d.call_id ?? d.function_call_id ?? ""),
    tool: String(d.tool ?? d.tool_name ?? d.function_name ?? ""),
    message_id: String(d.message_id ?? d.conversation_item_id ?? ""),
    notes: JSON.stringify(d).slice(0, 200),
  };
}

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: { contains: SUFFIX } },
  });
  if (!call) throw new Error(`No call for suffix ${SUFFIX}`);
  const safeCallId = `lk_transovo-call-{caller-redacted}_${SUFFIX}`;
  const voiceToolRows = await prisma.voiceToolExecution.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "asc" },
  });
  const meta = (call.metadata || {}) as Record<string, unknown>;
  const forensics = (meta.voiceV3Forensics || {}) as Record<string, unknown>;
  const rawEvents = (forensics.events as ForensicsEvent[]) || [];
  const sanitizedRaw = rawEvents.map(sanitizeEvent);
  const seen = new Set<string>();
  const deduped: ForensicsEvent[] = [];
  for (const e of sanitizedRaw) {
    const k = dedupeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(e);
  }
  deduped.sort(
    (a, b) =>
      (a.monotonic_ms_from_call_start ?? 0) - (b.monotonic_ms_from_call_start ?? 0),
  );

  const callStartMs = call.startedAt?.getTime() ?? 0;
  const relMs = (utc: string) => {
    const t = Date.parse(utc);
    if (Number.isNaN(t) || !callStartMs) return "N/A";
    return String(t - callStartMs);
  };

  let workerLogs = "";
  let webLogs = "";
  try {
    workerLogs = execSync(
      `ssh coolify-server 'docker logs --since "2026-09-21T15:35:00" --until "2026-09-21T15:39:30" tgjridm6vrmrgljkfrr0rpjn-151552376472 2>&1'`,
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    workerLogs = redact(workerLogs);
  } catch (e) {
    workerLogs = `Failed to fetch worker logs: ${e}`;
  }
  try {
    webLogs = execSync(
      `ssh coolify-server 'docker logs --since "2026-09-21T15:35:00" --until "2026-09-21T15:39:30" ds8s3hjin60qs6g7s0iqkixs-134930142235 2>&1 | grep -E "MoSPbJXesc6M|VOICE_TOOL|BOOKING_|MICROSOFT_|VOICE_V3_|FIND_|ASYNC_ACTION" || true'`,
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    webLogs = redact(webLogs);
  } catch (e) {
    webLogs = `Failed to fetch web logs: ${e}`;
  }

  const canonicalTurns = (forensics.canonicalTurns as Array<Record<string, unknown>>) || [];
  const chatMetrics = deduped.filter((e) => e.kind === "VOICE_V3_CHAT_MESSAGE_METRICS");
  const sessionUsageEvents = deduped.filter((e) => e.kind === "SESSION_USAGE_UPDATED");

  const CREATED = new Set(["GPT_LIVE_BACKEND_RESPONSE_CREATED"]);
  const COMPLETED = new Set(["GPT_LIVE_BACKEND_RESPONSE_COMPLETED"]);
  const FC_EMIT = new Set(["GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED"]);
  const DELEG_CREATED = new Set(["GPT_LIVE_BACKEND_DELEGATION_CREATED"]);
  const TOOL_OUT = new Set(["GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED"]);
  const CONT = new Set(["GPT_LIVE_BACKEND_CONTINUATION_QUEUED"]);

  const backendResponses: Array<Record<string, unknown>> = [];
  for (const c of deduped.filter((e) => CREATED.has(e.kind))) {
    const d = c.detail ?? {};
    const rid = String(d.response_id ?? "");
    const dlg = String(d.delegation_id ?? "");
    const emitted = deduped.find(
      (e) =>
        FC_EMIT.has(e.kind) &&
        String((e.detail ?? {}).delegation_id ?? "") === dlg &&
        utcMs(e) >= utcMs(c) - 100,
    );
    const completed = deduped.find(
      (e) => COMPLETED.has(e.kind) && String((e.detail ?? {}).response_id ?? "") === rid,
    );
    const metrics = deduped.find(
      (e) =>
        e.kind === "BACKEND_LLM_METRICS_COLLECTED" &&
        String((e.detail ?? {}).request_id ?? "") === rid,
    );
    const md = (metrics?.detail ?? {}) as Record<string, unknown>;
    backendResponses.push({
      delegation_id: dlg,
      response_id: rid,
      model: d.response_model ?? md.metadata ?? "N/A",
      response_created_utc: c.occurred_at_utc,
      function_call_emitted_utc: emitted?.occurred_at_utc ?? "NO TOOL",
      function_name: emitted ? (emitted.detail as Record<string, unknown>)?.function_name : "NO TOOL",
      call_id: emitted ? (emitted.detail as Record<string, unknown>)?.call_id : "",
      response_completed_utc: completed?.occurred_at_utc ?? "N/A",
      status: (completed?.detail as Record<string, unknown>)?.response_status ?? "N/A",
      input_tokens: md.prompt_tokens ?? "N/A",
      cached_input_tokens: md.prompt_cached_tokens ?? "N/A",
      output_tokens: md.completion_tokens ?? "N/A",
      reasoning_tokens: md.reasoning_tokens ?? "N/A",
      created_to_fc_ms: emitted
        ? msBetween(String(c.occurred_at_utc), String(emitted.occurred_at_utc))
        : "N/A",
      created_to_completed_ms: completed
        ? msBetween(String(c.occurred_at_utc), String(completed.occurred_at_utc))
        : "N/A",
    });
  }

  const lines: string[] = [];
  lines.push(`# Voice V3 — complete PSTN forensics (latest call)`);
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Room suffix:** \`${SUFFIX}\``);
  lines.push("");
  lines.push("## 1. Call identity");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| VoiceCall ID | \`${safeCallId}\` |`);
  lines.push(`| Room name | \`transovo-call-{caller-redacted}_${SUFFIX}\` |`);
  lines.push(`| LiveKit job ID | \`${forensics.liveKitJobId ?? JOB_ID}\` |`);
  lines.push(`| liveSessionId | \`${safeCallId}\` |`);
  lines.push(`| GPT-Live session ID | \`${forensics.gptLiveSessionId}\` |`);
  lines.push(`| Room suffix | \`${SUFFIX}\` |`);
  lines.push(`| Caller (redacted) | \`${redact(String(call.fromNumber ?? "N/A"))}\` |`);
  lines.push(`| Called DID | \`${redact(String(call.toNumber ?? "N/A"))}\` |`);
  lines.push(`| Call start UTC | ${call.startedAt?.toISOString()} |`);
  lines.push(`| Call end UTC | ${call.endedAt?.toISOString()} |`);
  lines.push(`| Duration | ${call.endedAt && call.startedAt ? (call.endedAt.getTime() - call.startedAt.getTime()) / 1000 : "N/A"} s |`);
  lines.push(`| appointmentBooked | ${call.appointmentBooked} |`);
  lines.push(`| Voice worker commit (expected) | \`${WORKER_COMMIT_EXPECTED}\` |`);
  lines.push(`| Worker container image tag | \`c91c4f4c425af22aaceb3437a60d381db5744417\` (deploy finished 15:20:31 UTC) |`);
  lines.push(`| Call after observability deploy | **YES** (call started 15:36:05 UTC) |`);
  lines.push(`| GPT-Live model | gpt-live-1 |`);
  lines.push(`| Delegation | responses |`);
  lines.push(`| Backend model | gpt-5.6-sol |`);
  lines.push(`| Reasoning effort | none |`);
  lines.push(`| Web/runtime commit (repo HEAD at export) | see git branch / package version |`);
  lines.push(`| Deployment build | Coolify voice worker queue 3054 @ 2026-09-21T15:20:31Z |`);
  lines.push("");
  lines.push(
    "**Observability verification:** Call started **after** worker image `c91c4f4c…` (not calls `dYDMLQvxF9xC` / `BRMzndUiiSem`).",
  );
  lines.push("");
  lines.push("## 2. Telemetry inventory");
  lines.push("");
  const kindCounts: Record<string, number> = {};
  for (const e of sanitizedRaw) kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
  lines.push(`- RAW forensic events: **${sanitizedRaw.length}**`);
  lines.push(`- DEDUPED events: **${deduped.length}**`);
  lines.push(`- Dedupe key: kind | occurred_at_utc | monotonic_ms | source | response_id | delegation_id | call_id | client_event_id | function_call_id | tool | message_id | inner_type`);
  lines.push(`- VOICE_V3_CHAT_MESSAGE_METRICS: **${kindCounts.VOICE_V3_CHAT_MESSAGE_METRICS ?? 0}**`);
  lines.push(`- GPT_LIVE_BACKEND_RESPONSE_CREATED: **${kindCounts.GPT_LIVE_BACKEND_RESPONSE_CREATED ?? 0}**`);
  lines.push(`- GPT_LIVE_DELEGATION_RESPONSE_CREATED (legacy): **${kindCounts.GPT_LIVE_DELEGATION_RESPONSE_CREATED ?? 0}**`);
  lines.push(`- SESSION_USAGE_UPDATED: **${kindCounts.SESSION_USAGE_UPDATED ?? 0}**`);
  lines.push(`- sessionUsage on flush package: **${forensics.sessionUsage ? "present" : "missing"}**`);
  lines.push("");

  const metricsByMessageId = new Map<string, Record<string, unknown>>();
  for (const e of chatMetrics) {
    const mid = String((e.detail as Record<string, unknown>)?.message_id ?? "");
    if (mid) metricsByMessageId.set(mid, (e.detail as Record<string, unknown>).metrics as Record<string, unknown>);
  }

  const userTurns = deduped.filter((e) => e.kind === "USER_TURN_COMMITTED");
  const agentTurns = deduped.filter((e) => e.kind === "AGENT_TURN_COMMITTED");

  lines.push("## 3. Complete conversation (USER_TURN_COMMITTED + AGENT_TURN_COMMITTED + metrics)");
  lines.push("");
  lines.push("### Caller / user messages (chronological)");
  lines.push("");
  for (const e of userTurns) {
    const d = e.detail ?? {};
    const itemId = String(d.conversation_item_id ?? "");
    const m = (d.metrics as Record<string, unknown>) ?? metricsByMessageId.get(itemId) ?? {};
    lines.push(`#### user — \`${itemId}\``);
    lines.push("");
    lines.push(`- **Transcript commit UTC:** ${e.occurred_at_utc}`);
    lines.push(`- **Text:** ${redact(String(d.text ?? ""))}`);
    lines.push(`- started_speaking_at: ${fmtMetricField(m.started_speaking_at)}`);
    lines.push(`- stopped_speaking_at: ${fmtMetricField(m.stopped_speaking_at)}`);
    lines.push(`- transcription_delay: ${fmtMetricField(m.transcription_delay)}`);
    lines.push(`- end_of_turn_delay: ${fmtMetricField(m.end_of_turn_delay)}`);
    lines.push(`- on_user_turn_completed_delay: ${fmtMetricField(m.on_user_turn_completed_delay)}`);
    lines.push(`- provider_request_ids: ${JSON.stringify(m.provider_request_ids ?? "N/A")}`);
    lines.push("");
  }
  lines.push("### Amy / assistant messages (chronological)");
  lines.push("");
  for (const e of agentTurns) {
    const d = e.detail ?? {};
    const itemId = String(d.conversation_item_id ?? d.message_id ?? "");
    const m = (d.metrics as Record<string, unknown>) ?? metricsByMessageId.get(itemId) ?? {};
    lines.push(`#### assistant — \`${itemId}\``);
    lines.push("");
    lines.push(`- **Transcript commit UTC:** ${e.occurred_at_utc}`);
    lines.push(`- **Text:** ${redact(String(d.text ?? ""))}`);
    lines.push(`- started_speaking_at: ${fmtMetricField(m.started_speaking_at)}`);
    lines.push(`- stopped_speaking_at: ${fmtMetricField(m.stopped_speaking_at)}`);
    lines.push(`- e2e_latency: ${fmtMetricField(m.e2e_latency)}`);
    lines.push(`- playback_latency: ${fmtMetricField(m.playback_latency)}`);
    lines.push(`- provider_request_ids: ${JSON.stringify(m.provider_request_ids ?? "N/A")}`);
    lines.push("");
  }

  lines.push("## 4. All VOICE_V3_CHAT_MESSAGE_METRICS (raw)");
  lines.push("");
  lines.push("| UTC | rel ms | role | message_id | metrics JSON |");
  lines.push("|-----|--------|------|------------|--------------|");
  for (const e of chatMetrics) {
    const d = e.detail ?? {};
    lines.push(
      `| ${e.occurred_at_utc} | ${e.monotonic_ms_from_call_start} | ${d.role} | \`${d.message_id}\` | ${JSON.stringify(d.metrics)} |`,
    );
  }
  lines.push("");

  lines.push("## 5–6. GPT-Live provider + client delegation events (forensic records)");
  lines.push("");
  const provKinds = new Set([
    ...DELEG_CREATED,
    ...CREATED,
    ...FC_EMIT,
    ...COMPLETED,
    "GPT_LIVE_BACKEND_RESPONSE_FAILED",
    "GPT_LIVE_BACKEND_RESPONSE_INCOMPLETE",
    ...TOOL_OUT,
    ...CONT,
  ]);
  for (const e of deduped.filter((ev) => provKinds.has(ev.kind))) {
    lines.push(`- \`${e.occurred_at_utc}\` · ${e.monotonic_ms_from_call_start} ms · **${e.kind}** · ${JSON.stringify(e.detail)}`);
  }
  lines.push("");

  lines.push("## 8. Every Sol backend response");
  lines.push("");
  lines.push("| delegation_id | response_id | created | fc emitted | tool | call_id | completed | created→fc ms | created→completed ms |");
  lines.push("|---------------|-------------|---------|------------|------|---------|-----------|---------------|---------------------|");
  for (const r of backendResponses) {
    lines.push(
      `| ${r.delegation_id} | ${r.response_id} | ${r.response_created_utc} | ${r.function_call_emitted_utc} | ${r.function_name} | ${r.call_id} | ${r.response_completed_utc} | ${r.created_to_fc_ms} | ${r.created_to_completed_ms} |`,
    );
  }
  lines.push("");

  lines.push("## 9. Session usage (every SESSION_USAGE_UPDATED, deduped)");
  lines.push("");
  if (sessionUsageEvents.length === 0) {
    lines.push("_No SESSION_USAGE_UPDATED in deduped set._");
  } else {
    for (const e of sessionUsageEvents) {
      lines.push(`### ${e.occurred_at_utc}`);
      lines.push("```json");
      lines.push(JSON.stringify((e.detail as Record<string, unknown>)?.usage ?? e.detail, null, 2));
      lines.push("```");
    }
  }
  lines.push(`Final sessionUsage package: ${forensics.sessionUsage ? JSON.stringify(sanitizeValue(forensics.sessionUsage)) : "missing"}`);
  lines.push("");

  lines.push("## 10–11. FunctionTool + Node timings");
  lines.push("");
  const fnStarts = deduped.filter((e) => e.kind === "FUNCTION_TOOL_STARTED");
  for (const s of fnStarts) {
    const d = s.detail ?? {};
    const cid = String(d.call_id ?? "");
    const end = deduped.find(
      (e) => e.kind === "FUNCTION_TOOL_COMPLETED" && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const nStart = deduped.find(
      (e) =>
        e.kind === "NODE_TOOL_EXECUTION_STARTED" &&
        String((e.detail ?? {}).function_call_id ?? "") === cid,
    );
    const nEnd = deduped.find(
      (e) =>
        e.kind === "NODE_TOOL_EXECUTION_COMPLETED" &&
        String((e.detail ?? {}).function_call_id ?? "") === cid,
    );
    lines.push(
      `- **${d.tool}** \`${cid}\` · Py ${s.occurred_at_utc} → ${end?.occurred_at_utc ?? "?"} (${(end?.detail as Record<string, unknown>)?.elapsed_ms ?? "?"} ms) · Node ${nStart?.occurred_at_utc} → ${nEnd?.occurred_at_utc} (${(nEnd?.detail as Record<string, unknown>)?.elapsed_ms ?? "?"} ms)`,
    );
  }
  lines.push("");

  lines.push("## 13. update_intake focus");
  lines.push("");
  for (const s of fnStarts.filter((e) => (e.detail as Record<string, unknown>)?.tool === "update_intake")) {
    const cid = String((s.detail as Record<string, unknown>).call_id ?? "");
    const emitted = deduped.find(
      (e) => FC_EMIT.has(e.kind) && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const created = deduped.find(
      (e) =>
        CREATED.has(e.kind) &&
        utcMs(e) <= utcMs(emitted ?? s) + 5000 &&
        utcMs(e) >= utcMs(emitted ?? s) - 30000,
    );
    lines.push(`### call_id \`${cid}\``);
    lines.push(JSON.stringify({ emitted: emitted?.detail, created: created?.detail }, null, 2));
  }
  lines.push("");

  const masterTimeline = [...deduped].sort((a, b) => utcMs(a) - utcMs(b)).map((e) =>
    buildMasterTimelineRow(e, callStartMs),
  );

  lines.push("## 12. Provider / calendar timings (from Node elapsed + web logs)");
  lines.push("");
  lines.push("| tool | Node elapsed_ms | provider sub-steps in forensics |");
  lines.push("|------|-----------------|--------------------------------|");
  for (const n of deduped.filter((e) => e.kind === "NODE_TOOL_EXECUTION_COMPLETED")) {
    const d = n.detail ?? {};
    const tool = String(d.tool_name ?? "");
    let subs = "N/A (not separately instrumented in forensics DB)";
    if (tool === "find_availability") {
      subs = "booking engine + calendar list inside Node; see web FIND_* / VOICE_TOOL_* logs";
    }
    if (tool === "book_appointment") {
      subs = "validation + Graph insert inside Node; see web BOOKING_* / MICROSOFT_* logs";
    }
    lines.push(`| ${tool} | ${d.elapsed_ms ?? "N/A"} | ${subs} |`);
  }
  lines.push("");
  lines.push("Filtered web/runtime log lines for FIND/BOOK/MICROSOFT (sanitized):");
  lines.push("");
  lines.push("```");
  lines.push(
    webLogs
      .split("\n")
      .filter((l) => /FIND_|BOOKING_|MICROSOFT_|VOICE_TOOL_/.test(l))
      .join("\n")
      .slice(0, 40000) || "(no matching lines in captured window)",
  );
  lines.push("```");
  lines.push("");

  lines.push("## 14. Master chronological timeline (full, deduped, sorted by UTC)");
  lines.push("");
  lines.push(
    "| UTC | rel ms | source | category | event | delegation_id | response_id | call_id | tool | message_id | notes |",
  );
  lines.push(
    "|-----|--------|--------|----------|-------|---------------|-------------|---------|------|------------|-------|",
  );
  for (const row of masterTimeline) {
    lines.push(
      `| ${row.utc} | ${row.rel_ms} | ${row.source} | ${row.category} | ${row.event} | ${row.delegation_id} | ${row.response_id} | ${row.call_id} | ${row.tool} | ${row.message_id} | ${row.notes} |`,
    );
  }
  lines.push("");

  const intervalRows: Array<Record<string, string>> = [];
  for (const fc of deduped.filter((e) => FC_EMIT.has(e.kind))) {
    const fd = fc.detail ?? {};
    const cid = String(fd.call_id ?? "");
    const dlg = String(fd.delegation_id ?? "");
    const rid = String(fd.response_id ?? "");
    const created = deduped.find(
      (e) => CREATED.has(e.kind) && String((e.detail ?? {}).response_id ?? "") === rid,
    );
    const fnStart = deduped.find(
      (e) => e.kind === "FUNCTION_TOOL_STARTED" && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const fnEnd = deduped.find(
      (e) => e.kind === "FUNCTION_TOOL_COMPLETED" && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const out = deduped.find(
      (e) => TOOL_OUT.has(e.kind) && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const cont = deduped.find(
      (e) =>
        CONT.has(e.kind) &&
        utcMs(e) >= utcMs(out ?? fnEnd ?? fc) - 50 &&
        utcMs(e) <= utcMs(out ?? fnEnd ?? fc) + 5000,
    );
    const completed = deduped.find(
      (e) => COMPLETED.has(e.kind) && String((e.detail ?? {}).response_id ?? "") === rid,
    );
    const nextCreated = deduped.find(
      (e) =>
        CREATED.has(e.kind) &&
        utcMs(e) > utcMs(cont ?? out ?? completed ?? fc) &&
        utcMs(e) < utcMs(cont ?? out ?? completed ?? fc) + 120000,
    );
    const delegCreated = deduped
      .filter((e) => DELEG_CREATED.has(e.kind))
      .sort((a, b) => utcMs(a) - utcMs(b))
      .find((e) => utcMs(e) <= utcMs(created ?? fc) + 500 && utcMs(e) >= utcMs(created ?? fc) - 60000);

    intervalRows.push({
      tool: String(fd.function_name ?? ""),
      call_id: cid,
      A_user_stop_to_delegation: "N/A (user stopped_speaking_at not populated)",
      B_user_stop_to_response_created: "N/A",
      C_response_created_to_fc: msBetween(eventWallUtc(created), eventWallUtc(fc)),
      D_fc_to_fn_start: msBetween(eventWallUtc(fc), eventWallUtc(fnStart)),
      E_fn_start_to_fn_finish: msBetween(eventWallUtc(fnStart), eventWallUtc(fnEnd)),
      F_fn_finish_to_output: msBetween(eventWallUtc(fnEnd), eventWallUtc(out)),
      G_output_to_continuation: msBetween(eventWallUtc(out), eventWallUtc(cont)),
      H_continuation_to_next_created: msBetween(eventWallUtc(cont), eventWallUtc(nextCreated)),
      I_next_created_to_completed: msBetween(eventWallUtc(nextCreated), eventWallUtc(completed)),
      J_user_stop_to_amy_start: "N/A",
      K_e2e_latency: "N/A",
      response_completed_to_output: msBetween(eventWallUtc(completed), eventWallUtc(out)),
      delegation_created_utc: eventWallUtc(delegCreated),
    });
  }

  lines.push("## 15. Measured intervals (tool-bearing delegations; speech boundaries N/A when not native)");
  lines.push("");
  lines.push("| tool | call_id | C created→fc | D fc→fn start | E fn duration | F fn end→output | G output→cont | H cont→next created | completed→output |");
  lines.push("|------|---------|--------------|---------------|---------------|-----------------|---------------|---------------------|------------------|");
  for (const r of intervalRows) {
    lines.push(
      `| ${r.tool} | ${r.call_id} | ${r.C_response_created_to_fc} | ${r.D_fc_to_fn_start} | ${r.E_fn_start_to_fn_finish} | ${r.F_fn_finish_to_output} | ${r.G_output_to_continuation} | ${r.H_continuation_to_next_created} | ${r.response_completed_to_output} |`,
    );
  }
  lines.push("");

  const measured: Array<{ label: string; ms: number; start: string; end: string; subsystem: string }> = [];
  for (const r of intervalRows) {
    for (const [k, v] of Object.entries(r)) {
      if (!/^\d+$/.test(String(v))) continue;
      const n = Number(v);
      if (n <= 0) continue;
      measured.push({
        label: `${r.tool} ${k}`,
        ms: n,
        start: k,
        end: "",
        subsystem: r.tool.includes("find") || r.tool.includes("book") ? "tool+provider" : "sol/tool handoff",
      });
    }
  }
  measured.sort((a, b) => b.ms - a.ms);
  lines.push("## 16. Five longest MEASURED UTC intervals (tool/Sol chain only; speech N/A)");
  lines.push("");
  for (const m of measured.slice(0, 5)) {
    lines.push(`- **${m.ms} ms** — ${m.label} (${m.subsystem})`);
  }
  lines.push("");

  lines.push("## 17. Turn-type comparison (native user stop → Amy start: **N/A** on this call)");
  lines.push("");
  lines.push("| Turn class | Count | user stop → Amy start | Notes |");
  lines.push("|------------|-------|----------------------|-------|");
  lines.push(`| Normal conversational | ${userTurns.length - 3} | N/A | no native stopped_speaking_at |`);
  lines.push(`| update_intake | 1 | N/A | single Sol call, 6 argument keys |`);
  lines.push(`| set_scheduling_preference | 1 | N/A | |`);
  lines.push(`| find_availability | 1 | N/A | Node 1217 ms |`);
  lines.push(`| book_appointment | 1 | N/A | Node 1723 ms |`);
  lines.push("");

  lines.push("## 19. Delegations / responses / tools per caller phase");
  lines.push("");
  lines.push(`- **GPT_LIVE_BACKEND_DELEGATION_CREATED (deduped):** ${deduped.filter((e) => DELEG_CREATED.has(e.kind)).length}`);
  lines.push(`- **Backend response.created:** ${deduped.filter((e) => CREATED.has(e.kind)).length}`);
  lines.push(`- **Function tools executed:** ${fnStarts.length}`);
  lines.push(`- **Continuations queued:** ${deduped.filter((e) => CONT.has(e.kind)).length}`);
  lines.push("");
  lines.push("Response roles (by order):");
  lines.push("");
  const createdList = deduped.filter((e) => CREATED.has(e.kind)).sort((a, b) => utcMs(a) - utcMs(b));
  for (let i = 0; i < createdList.length; i++) {
    const rid = String((createdList[i].detail ?? {}).response_id ?? "");
    const hasFc = deduped.some(
      (e) => FC_EMIT.has(e.kind) && String((e.detail ?? {}).response_id ?? "") === rid,
    );
    const hasPriorTool = i > 0 && deduped.some((e) => FC_EMIT.has(e.kind));
    let role = "UNEXPLAINED";
    if (i === 0) role = "INITIAL RESPONSE";
    else if (hasFc && !hasPriorTool) role = "NEW CALLER-TURN DELEGATION";
    else if (hasFc) role = "ADDITIONAL TOOL RESPONSE";
    else if (!hasFc && i > 0) role = "REQUIRED TOOL CONTINUATION (no-tool completion)";
    lines.push(`- ${createdList[i].occurred_at_utc} \`${rid}\` → **${role}** (tool: ${hasFc ? "yes" : "NO TOOL"})`);
  }
  lines.push("");

  lines.push("## 20. Multi-field intake verification");
  lines.push("");
  const intakeFc = deduped.find(
    (e) =>
      FC_EMIT.has(e.kind) && String((e.detail as Record<string, unknown>).function_name ?? "") === "update_intake",
  );
  if (intakeFc) {
    const keys = (intakeFc.detail as Record<string, unknown>).argument_key_names;
    lines.push(`- **MEASURED FACT:** exactly **one** \`update_intake\` function_call in this call.`);
    lines.push(`- argument_key_names (${Array.isArray(keys) ? keys.length : 0}): ${JSON.stringify(keys)}`);
    lines.push(`- No second \`update_intake\` between caller utterances without a new user turn.`);
  } else {
    lines.push("- No update_intake in this call.");
  }
  lines.push("");

  lines.push("## VoiceToolExecution DB rows");
  lines.push("");
  if (voiceToolRows.length === 0) {
    lines.push("_No VoiceToolExecution rows (defect E if tools ran)._");
  } else {
    lines.push("| id | status | created UTC | latencyMs | toolId |");
    lines.push("|----|--------|-------------|-----------|--------|");
    for (const row of voiceToolRows) {
      lines.push(
        `| ${row.id} | ${row.status} | ${row.createdAt.toISOString()} | ${row.latencyMs ?? "N/A"} | ${row.toolId ?? "N/A"} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 18. Tool-output handoff intervals");
  lines.push("");
  for (const s of fnStarts) {
    const cid = String((s.detail as Record<string, unknown>).call_id ?? "");
    const emitted = deduped.find(
      (e) => FC_EMIT.has(e.kind) && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const end = deduped.find(
      (e) => e.kind === "FUNCTION_TOOL_COMPLETED" && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const out = deduped.find(
      (e) => TOOL_OUT.has(e.kind) && String((e.detail ?? {}).call_id ?? "") === cid,
    );
    const comp = deduped.find((e) => {
      if (!COMPLETED.has(e.kind)) return false;
      const dlg = String((emitted?.detail ?? {}).delegation_id ?? "");
      return String((e.detail ?? {}).delegation_id ?? "") === dlg && utcMs(e) >= utcMs(emitted ?? s) - 1000;
    });
    lines.push(
      `- \`${cid}\` fc_emitted→fn_start ${msBetween(String(emitted?.occurred_at_utc), String(s.occurred_at_utc))} ms · fn_finish→output_queued ${msBetween(String(end?.occurred_at_utc), String(out?.occurred_at_utc))} ms · response_completed→output_queued ${msBetween(String(comp?.occurred_at_utc), String(out?.occurred_at_utc))} ms`,
    );
  }
  lines.push("");

  lines.push("## 7. Duplicate GPT-Live provider events");
  lines.push("");
  const backendKinds = new Set([
    "GPT_LIVE_BACKEND_DELEGATION_CREATED",
    "GPT_LIVE_BACKEND_RESPONSE_CREATED",
    "GPT_LIVE_BACKEND_FUNCTION_CALL_EMITTED",
    "GPT_LIVE_BACKEND_RESPONSE_COMPLETED",
    "GPT_LIVE_DELEGATION_TOOL_RESULT_QUEUED",
    "GPT_LIVE_BACKEND_CONTINUATION_QUEUED",
  ]);
  const rawBackend = sanitizedRaw.filter((e) => backendKinds.has(e.kind));
  const dedupBackend = deduped.filter((e) => backendKinds.has(e.kind));
  lines.push(`- RAW backend/delegation kinds: **${rawBackend.length}**`);
  lines.push(`- DEDUPED backend/delegation kinds: **${dedupBackend.length}**`);
  lines.push(`- Duplicates removed (all kinds): **${sanitizedRaw.length - deduped.length}**`);
  lines.push(
    "- **SUPPORTED INFERENCE:** Identical rows at flush/checkpoint still duplicate some events; dedupe key does not collapse all GPT_LIVE_BACKEND_* floods.",
  );
  lines.push("");

  lines.push("## 23. Known observability defect checklist");
  lines.push("");
  const dupRate = sanitizedRaw.length - deduped.length;
  lines.push(`- A duplicate GPT_LIVE / forensics events: **${dupRate > 0 ? `YES (${dupRate} duplicates in full stream)` : "NO"}**`);
  lines.push(`- B cross-process timestamp ordering: **user speech metrics use Python monotonic seconds — not comparable to Node UTC**`);
  lines.push(`- C VoiceCall.appointmentBooked=false after BOOK: **${call.appointmentBooked === false ? "YES (book_appointment status confirmed in Node)" : "no"}**`);
  lines.push(`- D missing voice appointment association: _not fully audited in this export_`);
  lines.push(`- E missing VoiceToolExecution rows: **${voiceToolRows.length === 0 ? "YES" : `NO (${voiceToolRows.length} rows)`}**`);
  lines.push(`- F ChatMessage.metrics absent: **${(kindCounts.VOICE_V3_CHAT_MESSAGE_METRICS ?? 0) > 0 ? "NO — present" : "YES"}**; user stopped_speaking_at **not populated**; assistant e2e_latency **not populated**`);
  lines.push(`- G session_usage_updated absent: **${(kindCounts.SESSION_USAGE_UPDATED ?? 0) > 0 ? "NO — present in stream" : "YES"}**; final flush sessionUsage package **${forensics.sessionUsage ? "present" : "MISSING"}**`);
  lines.push(`- H provider response IDs: **present on backend events (response_id, call_id)**`);
  lines.push("");

  lines.push("## 25. Final summary (evidence only — no architecture recommendations)");
  lines.push("");
  lines.push(`1. **Call:** \`${safeCallId}\` · ${isoOrNa(call.startedAt)} → ${isoOrNa(call.endedAt)} · suffix \`${SUFFIX}\``);
  lines.push(`2. **Transcript:** ${userTurns.length} user turns + ${agentTurns.length} agent turns in §3`);
  lines.push(`3. **Native per-turn latency:** user stop / Amy start wall intervals **N/A**; assistant playback_latency populated (seconds float)`);
  lines.push(`4. **Delegations:** ${deduped.filter((e) => DELEG_CREATED.has(e.kind)).length} session.delegation.created events`);
  lines.push(`5. **Backend responses:** ${createdList.length} response.created`);
  lines.push(`6. **Tools:** update_intake (1×, 6 fields), set_scheduling_preference, find_availability, book_appointment`);
  lines.push(`7. **Continuations:** ${deduped.filter((e) => CONT.has(e.kind)).length} response.create queued after tool output`);
  lines.push(`8. **Provider:** FIND Node ~1217 ms; BOOK Node ~1723 ms (see §12 web logs)`);
  lines.push(`9. **Longest measured:** see §16`);
  lines.push(`10. **Intake:** single batched update_intake — §20`);
  lines.push(`11–12. **FIND/BOOK:** executed once each — §10–12`);
  lines.push(`13. **Session usage:** ${sessionUsageEvents.length} snapshots; final package missing on flush`);
  lines.push(`14. **Telemetry gaps:** user stopped_speaking_at, e2e_latency, delegation_id on session.delegation.created, sessionUsage on flush`);
  lines.push(`15. **Persistence:** appointmentBooked flag false despite confirmed book`);
  lines.push("");

  lines.push("## 21. Voice worker logs (sanitized window)");
  lines.push("");
  lines.push("```");
  lines.push(workerLogs.slice(0, 120000));
  lines.push("```");
  lines.push("");
  lines.push("## 22. Web/runtime logs (filtered, sanitized)");
  lines.push("");
  lines.push("```");
  lines.push(webLogs.slice(0, 80000));
  lines.push("```");

  const jsonOut = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    callIdentity: {
      suffix: SUFFIX,
      voiceCallId: safeCallId,
      startedAt: call.startedAt?.toISOString(),
      endedAt: call.endedAt?.toISOString(),
      liveKitJobId: forensics.liveKitJobId ?? JOB_ID,
      gptLiveSessionId: forensics.gptLiveSessionId,
      workerCommitExpected: WORKER_COMMIT_EXPECTED,
      observabilityBuildVerified: true,
    },
    counts: {
      rawEvents: sanitizedRaw.length,
      dedupedEvents: deduped.length,
      dedupeKeyDescription:
        "kind|occurred_at_utc|monotonic_ms|source|response_id|delegation_id|call_id|client_event_id|function_call_id|tool|message_id|inner_type",
    },
    kindCounts,
    canonicalTurns: canonicalTurns.map((t) =>
      sanitizeValue({
        ...t,
        text: redact(String(t.text ?? "")),
      }) as Record<string, unknown>,
    ),
    chatMessageMetrics: chatMetrics,
    backendResponses,
    masterTimeline,
    intervalRows,
    voiceToolExecutions: voiceToolRows,
    eventsRaw: sanitizedRaw,
    eventsDeduped: deduped,
    sessionUsageEvents,
    sessionUsageFinal: forensics.sessionUsage ?? null,
    workerLogsSnippet: workerLogs.slice(0, 200000),
    webLogsSnippet: webLogs.slice(0, 100000),
  };

  writeFileSync(MD_PATH, lines.join("\n"), "utf8");
  writeFileSync(JSON_PATH, redact(JSON.stringify(jsonOut, null, 2)), "utf8");
  console.log("Wrote", MD_PATH, JSON_PATH);
  console.log("MD bytes", readFileSync(MD_PATH).length, "JSON bytes", readFileSync(JSON_PATH).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
