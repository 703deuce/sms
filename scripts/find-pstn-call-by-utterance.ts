#!/usr/bin/env npx tsx
import * as ai from "../src/lib/voice/telnyx/ai-client";

const ASSISTANT = process.env.TELNYX_ASSISTANT_ID || "assistant-2d8562d9-8bd4-4ca2-abe9-d9e303311b61";
const NEEDLES = (process.env.UTTERANCE_NEEDLES || "Anthony Johnson,schedule sync,linking,kitchen sink")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const MAX = Number(process.env.MAX_CONVERSATIONS || "40");

async function main() {
  const listed = await ai.listConversations({ page: { size: MAX } });
  const data = (listed as { data?: unknown[] }).data || [];
  const rows = (Array.isArray(data) ? data : []).filter((r) => {
    const meta = ((r as Record<string, unknown>).metadata || {}) as Record<string, unknown>;
    return meta.assistant_id === ASSISTANT;
  });

  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const convId = String(row.id);
    const msgs = await ai.listConversationMessages(convId, {});
    const mdata = (msgs as { data?: unknown[] }).data || [];
    const text = (Array.isArray(mdata) ? mdata : [])
      .map((m) => String((m as Record<string, unknown>).content || (m as Record<string, unknown>).text || ""))
      .join("\n")
      .toLowerCase();
    const hit = NEEDLES.filter((n) => text.includes(n));
    if (hit.length >= 2 || (hit.includes("anthony johnson") && hit.length >= 1)) {
      console.log(JSON.stringify({ convId, created_at: row.created_at, needles: hit, metadata: row.metadata }, null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
