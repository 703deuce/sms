#!/usr/bin/env npx tsx
/**
 * Turn-by-turn latency from Telnyx conversation messages (PSTN).
 * npx tsx scripts/analyze-recent-pstn-turn-latency.ts [conversationId]
 */
import * as ai from "../src/lib/voice/telnyx/ai-client";

const ASSISTANT = process.env.TELNYX_ASSISTANT_ID || "assistant-2d8562d9-8bd4-4ca2-abe9-d9e303311b61";
const CONV_LIMIT = Number(process.env.CONV_LIMIT || "3");

function msBetween(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function fmtMs(ms: number) {
  if (ms < 0) return "?";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function analyzeConversation(convId: string, createdAt: string) {
  const msgs = await ai.listConversationMessages(convId, {});
  const mdata = (msgs as { data?: unknown[] }).data || [];
  const messages = (Array.isArray(mdata) ? mdata : []).sort((a, b) => {
    const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
    const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
    return ta - tb;
  });

  const t0 = new Date(createdAt).getTime();
  console.log(`\n${"=".repeat(72)}`);
  console.log(`CONVERSATION ${convId}`);
  console.log(`created_at=${createdAt}`);

  let lastUserAt: string | null = null;
  let lastAssistantAt: string | null = null;
  let lastToolAt: string | null = null;

  const gaps: Array<{ label: string; ms: number }> = [];

  for (const m of messages) {
    const msg = m as Record<string, unknown>;
    const at = String(msg.created_at);
    const off = fmtMs(new Date(at).getTime() - t0);
    const role = String(msg.role);
    const content = String(msg.content || msg.text || "").replace(/\s+/g, " ").trim();
    const toolCalls = msg.tool_calls as unknown[] | undefined;

    if (role === "user") {
      if (lastAssistantAt) {
        gaps.push({ label: "assistant→user (caller think/speak)", ms: msBetween(lastAssistantAt, at) });
      }
      lastUserAt = at;
      console.log(`\n${off} USER: ${content.slice(0, 120)}`);
      continue;
    }

    if (role === "assistant" && toolCalls?.length) {
      const names = toolCalls
        .map((tc) => {
          const fn = (tc as { function?: { name?: string } }).function;
          return fn?.name || "?";
        })
        .join(", ");
      if (lastUserAt) {
        gaps.push({ label: `user→tool_call (${names})`, ms: msBetween(lastUserAt, at) });
      }
      console.log(`\n${off} ASSISTANT tool_call: ${names}`);
      lastAssistantAt = at;
      continue;
    }

    if (role === "tool") {
      if (lastAssistantAt) {
        gaps.push({ label: "tool_call→tool_result", ms: msBetween(lastAssistantAt, at) });
      }
      lastToolAt = at;
      let summary = content.slice(0, 80);
      try {
        const j = JSON.parse(content) as Record<string, unknown>;
        summary = String(j.status || j.voice_v2_status || j.ok || j.speak || "").slice(0, 80);
        if (j.graph) summary += ` graph=${JSON.stringify(j.graph).slice(0, 60)}`;
        if (j.event_id) summary += ` event_id=yes`;
      } catch {
        /* raw */
      }
      console.log(`${off} TOOL: ${summary}`);
      continue;
    }

    if (role === "assistant") {
      if (lastToolAt) {
        gaps.push({ label: "tool_result→assistant speak", ms: msBetween(lastToolAt, at) });
        lastToolAt = null;
      } else if (lastUserAt) {
        gaps.push({ label: "user→assistant speak (no tool)", ms: msBetween(lastUserAt, at) });
      }
      lastAssistantAt = at;
      console.log(`\n${off} ASSISTANT: ${content.slice(0, 160)}`);
    }
  }

  console.log(`\n--- Gap summary (sorted by duration) ---`);
  const sorted = [...gaps].sort((a, b) => b.ms - a.ms);
  for (const g of sorted.slice(0, 12)) {
    console.log(`  ${fmtMs(g.ms).padStart(8)}  ${g.label}`);
  }
  const over3s = gaps.filter((g) => g.ms >= 3000);
  if (over3s.length) {
    console.log(`\n--- Gaps ≥ 3s ---`);
    for (const g of over3s) console.log(`  ${fmtMs(g.ms)}  ${g.label}`);
  }
}

async function main() {
  const argConv = process.argv[2];
  if (argConv) {
    await analyzeConversation(argConv, new Date().toISOString());
    return;
  }

  const listed = await ai.listConversations({});
  const data = (listed as { data?: unknown[] }).data || [];
  const rows = (Array.isArray(data) ? data : [])
    .filter((r) => {
      const meta = ((r as Record<string, unknown>).metadata || {}) as Record<string, unknown>;
      return meta.assistant_id === ASSISTANT;
    })
    .slice(0, CONV_LIMIT);

  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const meta = (row.metadata || {}) as Record<string, unknown>;
    await analyzeConversation(String(row.id), String(row.created_at));
    console.log("\ncalled_tools:", JSON.stringify(meta.called_tools));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
