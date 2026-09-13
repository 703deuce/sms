#!/usr/bin/env tsx
import { getPrisma } from "../src/lib/db";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const ASSISTANT = process.env.TELNYX_ASSISTANT_ID || "assistant-2d8562d9-8bd4-4ca2-abe9-d9e303311b61";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);

  const listed = await ai.listConversations({});
  const data = (listed as { data?: unknown[] }).data || [];
  const rows = (Array.isArray(data) ? data : []).filter((r) => {
    const meta = ((r as Record<string, unknown>).metadata || {}) as Record<string, unknown>;
    return meta.assistant_id === ASSISTANT;
  });

  const conv = rows[0] as Record<string, unknown> | undefined;
  if (!conv?.id) {
    console.log("No Telnyx conversations for assistant in first page");
    return;
  }

  const convId = String(conv.id);
  console.log("=== Telnyx conversation ===");
  console.log({
    id: convId,
    created_at: conv.created_at,
    metadata: conv.metadata,
  });

  const msgs = await ai.listConversationMessages(convId, {});
  const mdata = (msgs as { data?: unknown[] }).data || [];
  const messages = (Array.isArray(mdata) ? mdata : []).sort((a, b) => {
    const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
    const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
    return ta - tb;
  });

  console.log("\n=== Transcript (chronological) ===");
  for (const m of messages) {
    const msg = m as Record<string, unknown>;
    const content = String(msg.content || msg.text || "").replace(/\n/g, " ").trim();
    console.log(`\n${msg.created_at} [${msg.role}] ${msg.type || ""}`);
    if (content) console.log(" ", content.slice(0, 500));
    if (msg.tool_calls) {
      console.log("  tool_calls:", JSON.stringify(msg.tool_calls).slice(0, 800));
    }
    if (msg.role === "tool" && content) {
      console.log("  tool_result:", content.slice(0, 400));
    }
  }

  const meta = (conv.metadata || {}) as Record<string, unknown>;
  const cc = String(meta.call_control_id || "");

  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      OR: [
        { telnyxConversationId: convId },
        { agentId: AGENT_ID, startedAt: { gte: since } },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      fromE164: true,
      toE164: true,
      telnyxConversationId: true,
      metadata: true,
    },
  });
  console.log("\n=== VoiceCall rows ===");
  for (const c of calls) console.log(c);

  const callIds = calls.map((c) => c.id);
  const tools = await prisma.voiceToolExecution.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      OR: [{ callId: { in: callIds } }, { createdAt: { gte: since } }],
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  console.log("\n=== voiceToolExecution ===", tools.length);
  for (const t of tools) {
    const inp = (t.input || {}) as Record<string, unknown>;
    console.log({
      at: t.createdAt.toISOString(),
      tool: inp.toolType || inp.tool_type,
      status: t.status,
      latencyMs: t.latencyMs,
      callId: t.callId,
      error: t.errorMessage?.slice(0, 120),
      output: JSON.stringify(t.output).slice(0, 200),
    });
  }

  const ingress = await prisma.auditLog.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      event: "voice.tool_webhook.ingress",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { createdAt: true, detail: true },
  });
  console.log("\n=== tool webhook ingress (3h) ===", ingress.length);
  for (const a of ingress) {
    console.log(a.createdAt.toISOString(), (a.detail || "").slice(0, 280));
  }

  const audits = await prisma.auditLog.findMany({
    where: { workspaceId: WORKSPACE_ID, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { event: true, createdAt: true, detail: true },
  });
  console.log("\n=== Recent audit ===");
  for (const a of audits) {
    console.log(a.createdAt.toISOString(), a.event, (a.detail || "").slice(0, 180));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
