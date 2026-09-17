/**
 * Dump full OpenAI Realtime (wizard) session instructions for an agent — read-only export.
 *
 *   WORKSPACE_ID=ws_1 AGENT_ID=cmshz2lc25c622c4i58303501 \
 *     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/export-openai-realtime-wizard-prompt.ts
 *
 * Optional: OUT=/path/to/file.txt
 */
import { writeFileSync } from "node:fs";
import { loadOpenAiRealtimeSessionInstructions } from "@/lib/voice/telnyx/openai-realtime-bridge/instructions";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID =
  process.env.AGENT_ID || process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const OUT =
  process.env.OUT ||
  `/opt/cursor/artifacts/openai-realtime-wizard-prompt-${AGENT_ID}.txt`;

async function main() {
  const { instructions, greeting } = await loadOpenAiRealtimeSessionInstructions({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });

  const header = [
    "# OpenAI Realtime (GA) — full session instructions",
    `# workspace: ${WORKSPACE_ID}`,
    `# agent: ${AGENT_ID}`,
    `# exported: ${new Date().toISOString()}`,
    `# source: loadOpenAiRealtimeSessionInstructions() in src/lib/voice/telnyx/openai-realtime-bridge/instructions.ts`,
    `# layers: AMY_V2_CORE_STATIC_PROMPT + wizard compiled/base + intake + knowledge + qualification + after-hours + flags`,
    "",
    "## Greeting (Call Control / session — separate from instructions block)",
    greeting || "(none configured)",
    "",
    "## Full instructions (session.update)",
    "",
  ].join("\n");

  const body = `${header}${instructions}\n`;
  writeFileSync(OUT, body, "utf8");
  console.log(JSON.stringify({ ok: true, out: OUT, chars: instructions.length, greeting }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
