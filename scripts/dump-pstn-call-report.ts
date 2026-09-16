#!/usr/bin/env npx tsx
import * as ai from "../src/lib/voice/telnyx/ai-client";
import { getPrisma } from "../src/lib/db";

const IDS = process.argv.slice(2);
const ASSISTANT = "assistant-2d8562d9-8bd4-4ca2-abe9-d9e303311b61";

function fmtMs(ms: number) {
  if (ms < 0 || !Number.isFinite(ms)) return "?";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function parseToolSummary(content: string): string {
  try {
    const j = JSON.parse(content) as Record<string, unknown>;
    const parts = [
      j.status || j.voice_v2_status || (j.ok === true ? "ok" : j.ok === false ? "err" : ""),
      j.saved_fields || j.saved,
      j.missingBeforeBooking,
      j.readiness ? `ready=${JSON.stringify((j.readiness as { missingBeforeBooking?: unknown }).missingBeforeBooking)}` : "",
    ].filter(Boolean);
    if (j.graph) parts.push(`graph=${JSON.stringify(j.graph).slice(0, 120)}`);
    if (j.event_id) parts.push("graph_event_created=yes");
    if (j.offer_set_id) parts.push(`offer=${String(j.offer_set_id).slice(0, 24)}`);
    if (j.slots && Array.isArray(j.slots)) parts.push(`slots=${j.slots.length}`);
    return parts.join(" | ");
  } catch {
    return content.slice(0, 120);
  }
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

async function reportCall(convId: string, label: string) {
  const conv = await ai.getConversation(convId).catch(() => null);
  const meta = ((conv as { data?: Record<string, unknown> })?.data?.metadata ||
    (conv as Record<string, unknown>)?.metadata ||
    {}) as Record<string, unknown>;
  const createdAt = String(
    (conv as { data?: { created_at?: string } })?.data?.created_at ||
      meta.created_at ||
      "",
  );
  const t0 = createdAt ? new Date(createdAt).getTime() : 0;

  console.log(`\n${"#".repeat(80)}`);
  console.log(`${label}`);
  console.log(`conversation_id: ${convId}`);
  console.log(`call_control_id: ${meta.call_control_id || "?"}`);
  console.log(`started (Telnyx): ${createdAt}`);
  console.log(`called_tools (session): ${JSON.stringify(meta.called_tools || [])}`);

  const messages = await loadMessages(convId);
  console.log(`message_count: ${messages.length}`);

  type Ev = {
    at: string;
    offMs: number;
    kind: string;
    text: string;
  };
  const events: Ev[] = [];

  for (const msg of messages) {
    const at = String(msg.created_at);
    const offMs = t0 ? new Date(at).getTime() - t0 : 0;
    const role = String(msg.role);
    const content = String(msg.content || msg.text || "").trim();
    const toolCalls = msg.tool_calls as Array<{
      function?: { name?: string; arguments?: string };
    }> | undefined;

    if (role === "user") {
      events.push({ at, offMs, kind: "USER", text: content.replace(/\s+/g, " ") });
      continue;
    }
    if (role === "assistant" && toolCalls?.length) {
      for (const tc of toolCalls) {
        const name = tc.function?.name || "?";
        let args = tc.function?.arguments || "";
        try {
          const parsed = JSON.parse(args) as { fields?: unknown };
          if (parsed.fields) args = `fields=${JSON.stringify(parsed.fields)}`;
        } catch {
          args = args.slice(0, 100);
        }
        events.push({ at, offMs, kind: "AMY_TOOL_CALL", text: `${name} ${args}` });
      }
      continue;
    }
    if (role === "tool") {
      events.push({ at, offMs, kind: "TOOL_RESULT", text: parseToolSummary(content) });
      continue;
    }
    if (role === "assistant") {
      events.push({ at, offMs, kind: "AMY_SPEAK", text: content.replace(/\s+/g, " ") });
    }
  }

  console.log("\n--- Chronological transcript ---");
  for (const e of events) {
    console.log(`[+${fmtMs(e.offMs).padStart(7)}] ${e.kind}: ${e.text.slice(0, 500)}`);
  }

  console.log("\n--- Turn gaps (YOU ↔ AMY) ---");
  console.log(
    "  Δ = time from previous event to this one. 'YOU→AMY' = your last word to her next speech/tool.",
  );

  let prev: Ev | null = null;
  const gaps: Array<{ from: string; to: string; ms: number; note: string }> = [];

  for (const e of events) {
    if (!prev) {
      prev = e;
      continue;
    }
    const ms = new Date(e.at).getTime() - new Date(prev.at).getTime();
    const prevIsUser = prev.kind === "USER";
    const curIsAmy = e.kind === "AMY_SPEAK" || e.kind === "AMY_TOOL_CALL";
    const prevIsAmy = prev.kind === "AMY_SPEAK" || prev.kind === "TOOL_RESULT" || prev.kind === "AMY_TOOL_CALL";
    const curIsUser = e.kind === "USER";

    let note = `${prev.kind} → ${e.kind}`;
    if (prevIsUser && curIsAmy) note = `YOU→AMY (response latency)`;
    if (prevIsUser && e.kind === "AMY_TOOL_CALL") note = `YOU→AMY tool decision`;
    if (prev.kind === "AMY_TOOL_CALL" && e.kind === "TOOL_RESULT") note = `tool round-trip (our API + Graph)`;
    if (prev.kind === "TOOL_RESULT" && e.kind === "AMY_SPEAK") note = `tool→AMY speak (TTS)`;
    if (prevIsAmy && curIsUser) note = `AMY→YOU (your think/speak time)`;

    gaps.push({ from: prev.kind, to: e.kind, ms, note });
    console.log(`  Δ ${fmtMs(ms).padStart(7)}  ${note}`);
    if (prevIsUser && (e.kind === "AMY_SPEAK" || e.kind === "AMY_TOOL_CALL")) {
      const chain: Ev[] = [e];
      let j = events.indexOf(e) + 1;
      while (j < events.length && events[j].kind !== "USER" && events[j].kind !== "AMY_SPEAK") {
        chain.push(events[j]);
        j++;
      }
      const end = chain.find((x) => x.kind === "AMY_SPEAK") || chain[chain.length - 1];
      const total = new Date(end.at).getTime() - new Date(prev.at).getTime();
      if (end.kind === "AMY_SPEAK" && chain.length > 1) {
        console.log(
          `           └─ YOU→audible AMY (incl. tools): ${fmtMs(total)}  (${chain.map((c) => c.kind).join(" → ")})`,
        );
      }
    }
    prev = e;
  }

  const youToAmy = gaps.filter((g) => g.note.startsWith("YOU→"));
  const toolRtt = gaps.filter((g) => g.note.includes("round-trip"));
  const maxYouToAmy = youToAmy.reduce((a, b) => (b.ms > a.ms ? b : a), { ms: 0, note: "" });
  console.log("\n--- Latency summary ---");
  if (youToAmy.length) {
    const avg = youToAmy.reduce((s, g) => s + g.ms, 0) / youToAmy.length;
    console.log(`  YOU→AMY (first reaction): avg ${fmtMs(avg)}, max ${fmtMs(maxYouToAmy.ms)}`);
  }
  if (toolRtt.length) {
    const avg = toolRtt.reduce((s, g) => s + g.ms, 0) / toolRtt.length;
    console.log(`  Tool round-trip: avg ${fmtMs(avg)}, n=${toolRtt.length}`);
  }

  const cc = String(meta.call_control_id || "");
  if (cc) {
    const prisma = getPrisma();
    const book = await prisma.auditLog.findFirst({
      where: {
        event: "voice_v2.pstn_book_trace",
        detail: { contains: cc.slice(0, 40) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (book?.detail) console.log(`\n--- Booking audit ---\n${book.detail}`);
  }
}

async function main() {
  let ids = IDS;
  if (!ids.length) {
    const listed = await ai.listConversations({});
    const data = (listed as { data?: unknown[] }).data || [];
    const rows = (Array.isArray(data) ? data : [])
      .filter((r) => {
        const meta = ((r as Record<string, unknown>).metadata || {}) as Record<string, unknown>;
        return meta.assistant_id === ASSISTANT;
      })
      .slice(0, 2);
    ids = rows.map((r) => String((r as Record<string, unknown>).id));
  }
  await reportCall(ids[0], "CALL A (most recent)");
  if (ids[1]) await reportCall(ids[1], "CALL B (previous)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
