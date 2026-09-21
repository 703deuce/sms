#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";

const CALLS = [
  {
    suffix: "dYDMLQvxF9xC",
    label: "Call A — opened with booking intent, then info-dump",
    jobId: "AJ_wnCPAu9HrrzA",
  },
  {
    suffix: "BRMzndUiiSem",
    label: "Call B — info-dump first, booking intent later",
    jobId: "AJ_awYQAZbmudFm",
  },
];

const DELEGATION = /^GPT_LIVE_DELEGATION_/;
const TOOL = /^(FUNCTION_TOOL_|NODE_TOOL_|BACKEND_LLM_METRICS)/;

type ForensicsEvent = {
  kind: string;
  occurred_at_utc?: string;
  monotonic_ms_from_call_start?: number;
  source?: string;
  detail?: Record<string, unknown>;
};

function chronology(events: ForensicsEvent[], filter: RegExp): string[] {
  return events
    .filter((e) => filter.test(e.kind))
    .map((e) => {
      const d = e.detail ?? {};
      const extra = [
        d.response_id ? `resp=${d.response_id}` : "",
        d.call_id ? `call_id=${d.call_id}` : "",
        d.function_name ? `fn=${d.function_name}` : "",
        d.tool_name ? `tool=${d.tool_name}` : "",
        d.tool ? `tool=${d.tool}` : "",
        d.delegation_id ? `dlg=${d.delegation_id}` : "",
        d.client_event_type ? `client=${d.client_event_type}` : "",
        d.request_id ? `resp=${d.request_id}` : "",
        d.elapsed_ms != null ? `elapsed_ms=${d.elapsed_ms}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `- \`${e.occurred_at_utc ?? "?"}\` · mono ${e.monotonic_ms_from_call_start ?? "?"} · **${e.kind}** (${e.source ?? "?"})${extra ? ` — ${extra}` : ""}`;
    });
}

async function loadEvents(suffix: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: { contains: suffix } },
    select: { id: true, startedAt: true, endedAt: true, metadata: true, appointmentBooked: true },
  });
  if (!call) throw new Error(`No call for ${suffix}`);
  const meta = (call.metadata || {}) as Record<string, unknown>;
  const forensics = meta.voiceV3Forensics as {
    events?: ForensicsEvent[];
    gptLiveSessionId?: string;
  };
  const events = [...(forensics?.events ?? [])].sort(
    (a, b) => (a.monotonic_ms_from_call_start ?? 0) - (b.monotonic_ms_from_call_start ?? 0),
  );
  const dumpEnd = events
    .filter((e) => e.kind === "CALLER_UTTERANCE_COMMITTED")
    .filter((e) => {
      const t = String((e.detail as { text?: string })?.text ?? "").toLowerCase();
      return t.includes("harriet") || t.includes("yahoo");
    })
    .pop();
  const schedQ = events
    .filter((e) => e.kind === "AGENT_TURN_COMMITTED")
    .find((e) => {
      const t = String((e.detail as { text?: string })?.text ?? "").toLowerCase();
      return t.includes("day and time") || t.includes("what day");
    });
  return {
    call,
    gptLive: forensics?.gptLiveSessionId,
    events,
    phase: {
      infoDumpEndMonotonicMs: dumpEnd?.monotonic_ms_from_call_start,
      schedulingQuestionMonotonicMs: schedQ?.monotonic_ms_from_call_start,
    },
  };
}

async function main() {
  const lines: string[] = [];
  lines.push("# Voice V3 — dual PSTN info-dump forensics (post–delegation telemetry)");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("**Voice worker image:** `52d31603b66a73f5aa262f02e47f2d8a47a53ad2`");
  lines.push("");
  lines.push("## Artifact index (GitHub — Raw on JSON for full copy)");
  lines.push("");
  lines.push("| Call | Summary | Tool JSON | Backend JSON |");
  lines.push("|------|---------|-----------|--------------|");
  for (const c of CALLS) {
    lines.push(
      `| \`${c.suffix}\` | [TOOL-CHAIN-${c.suffix}.md](./VOICE-V3-TOOL-CHAIN-${c.suffix}.md) | [events](./VOICE-V3-TOOL-CHAIN-${c.suffix}.events.json) | [backend](./VOICE-V3-TOOL-CHAIN-${c.suffix}.backend-events.json) |`,
    );
  }
  lines.push("");
  lines.push(
    "- [VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json](./VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json) — both calls, delegation + tool events only",
  );
  lines.push(
    "- [VOICE-V3-DUAL-PSTN-voice-worker-logs-2026-09-21.txt](./VOICE-V3-DUAL-PSTN-voice-worker-logs-2026-09-21.txt)",
  );
  lines.push(
    "- [VOICE-V3-DUAL-PSTN-web-logs-2026-09-21.txt](./VOICE-V3-DUAL-PSTN-web-logs-2026-09-21.txt)",
  );
  lines.push("");

  const exportBlob: Record<string, unknown> = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    calls: [] as unknown[],
  };

  for (const c of CALLS) {
    const { call, gptLive, events, phase } = await loadEvents(c.suffix);
    const delegationEvents = events.filter((e) => DELEGATION.test(e.kind));
    const toolEvents = events.filter((e) => TOOL.test(e.kind));

    const safeCallId = call.id.replace(/\+1\d{10}/g, "+1[REDACTED]");
    (exportBlob.calls as unknown[]).push({
      roomSuffix: c.suffix,
      callId: safeCallId,
      startedAt: call.startedAt?.toISOString(),
      endedAt: call.endedAt?.toISOString(),
      gptLiveSessionId: gptLive,
      appointmentBooked: call.appointmentBooked,
      phase,
      delegationEvents,
      toolEvents,
    });

    lines.push("---");
    lines.push("");
    lines.push(`## ${c.label}`);
    lines.push("");
    lines.push(`- **Room suffix:** \`${c.suffix}\``);
    lines.push(`- **Call id:** \`${safeCallId}\``);
    lines.push(`- **Wall clock:** ${call.startedAt?.toISOString()} → ${call.endedAt?.toISOString()}`);
    lines.push(`- **GPT-Live session:** \`${gptLive ?? "?"}\``);
    lines.push(`- **LiveKit job:** \`${c.jobId}\``);
    lines.push(`- **appointmentBooked:** ${call.appointmentBooked}`);
    if (phase.infoDumpEndMonotonicMs != null && phase.schedulingQuestionMonotonicMs != null) {
      lines.push(
        `- **Info-dump → scheduling question (mono):** ${phase.schedulingQuestionMonotonicMs - phase.infoDumpEndMonotonicMs} ms`,
      );
    }
    lines.push("");
    lines.push("### `GPT_LIVE_DELEGATION_*` chronology");
    lines.push("");
    lines.push(...chronology(events, DELEGATION));
    lines.push("");
    lines.push("### Tools + `BACKEND_LLM_METRICS_COLLECTED`");
    lines.push("");
    lines.push(...chronology(events, TOOL));
    lines.push("");
  }

  const mdPath = join(process.cwd(), "docs/VOICE-V3-DUAL-PSTN-INFO-DUMP-FORENSICS-2026-09-21.md");
  const jsonPath = join(process.cwd(), "docs/VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json");
  writeFileSync(mdPath, lines.join("\n") + "\n", "utf8");
  writeFileSync(jsonPath, JSON.stringify(exportBlob, null, 2) + "\n", "utf8");
  console.log("Wrote", mdPath, jsonPath);

  const p = getPrisma();
  if (typeof p.$disconnect === "function") await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
