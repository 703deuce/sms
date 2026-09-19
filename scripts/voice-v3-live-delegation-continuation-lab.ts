#!/usr/bin/env tsx
/**
 * OpenAI Live protocol lab: baseline vs withheld response.create after function_call_output.
 * Does NOT touch production Voice V3 runtime paths.
 * Optional research only — production freshness uses semantic supersession + pre-dispatch
 * authorization, not withheld response.create as cancellation.
 *
 * Usage:
 *   npx tsx scripts/voice-v3-live-delegation-continuation-lab.ts baseline
 *   npx tsx scripts/voice-v3-live-delegation-continuation-lab.ts withhold
 *   npx tsx scripts/voice-v3-live-delegation-continuation-lab.ts withhold_then_speech
 */
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

type LabMode = "baseline" | "withhold" | "withhold_then_speech";

type LogRow = {
  at_ms: number;
  source: "live_ws" | "lab";
  type: string;
  delegation_id?: string | null;
  offset_ms?: number;
  nested_type?: string;
  call_id?: string;
  detail?: Record<string, unknown>;
};

const LIVE_MODEL = "gpt-live-1";
const ASTRA_MODEL = process.env.VOICE_V3_LAB_ASTRA_MODEL?.trim() || "gpt-6-astra";
const OBSERVE_MS = Number(process.env.VOICE_V3_LAB_OBSERVE_MS ?? "90000");

function nowMs(): number {
  return Date.now();
}

function parseMode(argv: string[]): LabMode {
  const raw = (argv[2] || "baseline").trim();
  if (raw === "baseline" || raw === "withhold" || raw === "withhold_then_speech") {
    return raw;
  }
  throw new Error(`Unknown mode ${raw}. Use baseline | withhold | withhold_then_speech`);
}

function buildSessionStart() {
  return {
    type: "session.start" as const,
    session: {
      model: LIVE_MODEL,
      instructions: [
        "You are Amy on a phone call.",
        "When the caller wants to book or asks for help that needs backend lookup, delegate immediately to your Responses backend.",
        "Keep spoken replies short.",
      ].join(" "),
      input: [
        {
          type: "message" as const,
          role: "user" as const,
          content: [{ type: "input_text" as const, text: "I need to book something." }],
        },
      ],
      delegation: {
        type: "responses" as const,
        responses: {
          model: ASTRA_MODEL,
          instructions: [
            "You are Astra. When delegated for booking, call lab_read_ping exactly once, then stop.",
            "After lab_read_ping returns, respond with a short plain-text summary only. Do not call tools again.",
          ].join(" "),
          tool_choice: "auto" as const,
          parallel_tool_calls: false,
          max_output_tokens: 256,
          tools: [
            {
              type: "function" as const,
              name: "lab_read_ping",
              description: "Harmless read used only for protocol lab. Call once when delegated.",
              parameters: { type: "object", properties: {} },
            },
          ],
        },
      },
    },
  };
}

function extractFunctionCall(nested: Record<string, unknown>): {
  callId: string;
  name: string;
  args: string;
} | null {
  if (nested.type !== "response.output_item.done") return null;
  const item = nested.item;
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  if (row.type !== "function_call") return null;
  const callId = typeof row.call_id === "string" ? row.call_id : null;
  const name = typeof row.name === "string" ? row.name : null;
  if (!callId || !name) return null;
  const args =
    typeof row.arguments === "string" ? row.arguments : JSON.stringify(row.arguments ?? {});
  return { callId, name, args };
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const client = new OpenAI({ apiKey });
  const { LiveWS } = await import("openai/resources/live/ws");
  const live = new LiveWS(client);

  const log: LogRow[] = [];
  const t0 = nowMs();
  const push = (row: Omit<LogRow, "at_ms">) => {
    log.push({ at_ms: nowMs() - t0, ...row });
  };

  let sessionId: string | null = null;
  const delegations = new Map<
    string,
    { offset_ms?: number; response_id?: string; completed: boolean; failed: boolean; incomplete: boolean }
  >();
  const outputsSubmitted = new Set<string>();
  const continuationsSent = new Set<string>();
  const continuationBarriersSent = new Set<string>();
  let simulatedTurnSequence = 1;
  let withholdContinuationForDelegation: string | null = null;

  const pendingCalls = new Map<
    string,
    { delegationId: string | null; name: string; outputSubmitted: boolean }
  >();

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function hasPendingFunctionOutputs(): boolean {
    for (const row of pendingCalls.values()) {
      if (!row.outputSubmitted) return true;
    }
    return false;
  }

  function maybeDelegatedContinuation(delegationId: string): void {
    if (hasPendingFunctionOutputs()) return;
    const barrierKey = `${delegationId}:${outputsSubmitted.size}`;
    if (continuationBarriersSent.has(barrierKey)) return;
    continuationBarriersSent.add(barrierKey);

    const withhold =
      mode !== "baseline" &&
      (withholdContinuationForDelegation === null || withholdContinuationForDelegation === delegationId);

    if (withhold) {
      if (withholdContinuationForDelegation === null) {
        withholdContinuationForDelegation = delegationId;
      }
      push({
        source: "lab",
        type: "delegated.response.create_withheld",
        delegation_id: delegationId,
        detail: { reason: "protocol_lab", barrier_key: barrierKey },
      });
      if (mode === "withhold_then_speech") {
        void (async () => {
          await wait(2500);
          simulatedTurnSequence += 1;
          live.send({
            type: "session.instructions.append",
            delegation_id: null,
            content:
              "Caller committed new speech (lab simulation): Actually, I just have a question about your hours.",
          });
          push({
            source: "lab",
            type: "caller_speech_simulated",
            detail: { simulated_turn_sequence: simulatedTurnSequence },
          });
          await wait(1500);
          live.send({ type: "response.create" });
          push({
            source: "lab",
            type: "live_layer.response.create_sent",
            detail: { note: "after_simulated_caller_speech" },
          });
        })();
      }
      return;
    }

    live.send({ type: "response.create" });
    continuationsSent.add(delegationId);
    push({
      source: "lab",
      type: "delegated.response.create_sent",
      delegation_id: delegationId,
      detail: { reason: "baseline_delegated_continuation", barrier_key: barrierKey },
    });
  }

  function submitToolOutput(callId: string, delegationId: string, name: string): void {
    if (outputsSubmitted.has(callId)) return;
    const output = { ok: true, tool: name, mode, note: "lab_executor" };
    live.send({
      type: "response.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
    outputsSubmitted.add(callId);
    const row = pendingCalls.get(callId);
    if (row) row.outputSubmitted = true;
    push({
      source: "lab",
      type: "response.item.create_sent",
      delegation_id: delegationId,
      call_id: callId,
      detail: { name },
    });
    maybeDelegatedContinuation(delegationId);
  }

  let liveLayerResponseCreateSent = false;

  live.on("event", (serverEvent: Record<string, unknown>) => {
    const type = String(serverEvent.type || "unknown");
    if (type === "session.started") {
      const session = serverEvent.session as { id?: string } | undefined;
      sessionId = session?.id?.trim() || null;
      push({ source: "live_ws", type, detail: { session_id: sessionId } });
      if (!liveLayerResponseCreateSent) {
        liveLayerResponseCreateSent = true;
        live.send({ type: "response.create" });
        push({
          source: "lab",
          type: "live_layer.response.create_sent",
          detail: { note: "Triggers GPT-Live turn + delegation (not delegated continuation)" },
        });
      }
      return;
    }

    if (type === "session.delegation.created") {
      const delegation = serverEvent.delegation as { id?: string; response_id?: string } | undefined;
      const offset_ms = typeof serverEvent.offset_ms === "number" ? serverEvent.offset_ms : undefined;
      const id = delegation?.id?.trim() || "unknown";
      delegations.set(id, {
        offset_ms,
        response_id: delegation?.response_id,
        completed: false,
        failed: false,
        incomplete: false,
      });
      push({
        source: "live_ws",
        type,
        delegation_id: id,
        offset_ms,
        detail: {
          response_id: delegation?.response_id ?? null,
          simulated_turn_sequence: simulatedTurnSequence,
        },
      });
      return;
    }

    if (type === "response.event") {
      const nested = serverEvent.event as Record<string, unknown> | undefined;
      const delegation_id =
        typeof serverEvent.delegation_id === "string" ? serverEvent.delegation_id : null;
      const nestedType = nested ? String(nested.type || "") : "";
      push({
        source: "live_ws",
        type,
        delegation_id,
        nested_type: nestedType,
        detail: nested ? { keys: Object.keys(nested) } : undefined,
      });

      if (nested && delegation_id) {
        const d = delegations.get(delegation_id);
        if (d) {
          if (nestedType === "response.completed") d.completed = true;
          if (nestedType === "response.failed") d.failed = true;
          if (nestedType === "response.incomplete") d.incomplete = true;
        }
      }

      const fn = nested ? extractFunctionCall(nested) : null;
      if (fn && delegation_id) {
        if (!pendingCalls.has(fn.callId)) {
          pendingCalls.set(fn.callId, {
            delegationId: delegation_id,
            name: fn.name,
            outputSubmitted: false,
          });
          push({
            source: "lab",
            type: "function_call_observed",
            delegation_id,
            call_id: fn.callId,
            detail: { name: fn.name },
          });

          void (async () => {
            await wait(30);
            submitToolOutput(fn.callId, delegation_id, fn.name);
          })();
        }
      }
      return;
    }

    if (type === "error") {
      push({ source: "live_ws", type, detail: { error: serverEvent.error } });
      return;
    }

    push({ source: "live_ws", type });
  });

  live.on("error", (err: unknown) => {
    push({
      source: "live_ws",
      type: "ws_error",
      detail: { message: err instanceof Error ? err.message : String(err) },
    });
  });

  live.send(buildSessionStart());
  push({ source: "lab", type: "session.start_sent" });

  await wait(OBSERVE_MS);

  const outDir = process.env.VOICE_V3_LAB_OUT_DIR?.trim() || "/opt/cursor/artifacts";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `voice-v3-live-delegation-lab-${mode}.json`);
  const summary = {
    mode,
    session_id: sessionId,
    observe_ms: OBSERVE_MS,
    delegations: [...delegations.entries()].map(([id, d]) => ({ id, ...d })),
    function_calls: [...pendingCalls.entries()].map(([callId, row]) => ({
      call_id: callId,
      ...row,
    })),
    outputs_submitted: [...outputsSubmitted],
    continuations_sent: [...continuationsSent],
    continuation_barriers_sent: [...continuationBarriersSent],
    withheld_delegation_id: withholdContinuationForDelegation,
    simulated_turn_sequence_end: simulatedTurnSequence,
    delegation_count: delegations.size,
    log_event_count: log.length,
  };
  fs.writeFileSync(outPath, JSON.stringify({ summary, log }, null, 2));

  console.log("VOICE_V3_LIVE_DELEGATION_LAB_DONE", JSON.stringify(summary, null, 2));
  console.log("artifact", outPath);

  try {
    live.close();
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error("VOICE_V3_LIVE_DELEGATION_LAB_FAILED", err);
  process.exit(1);
});
