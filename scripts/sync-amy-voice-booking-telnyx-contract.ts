#!/usr/bin/env npx tsx
/**
 * Sync published Amy assistant to Telnyx (structured voice_ai_booking_turn contract).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/sync-amy-voice-booking-telnyx-contract.ts
 */
import { getPrisma } from "../src/lib/db";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { syncTelnyxAssistant } from "../src/lib/voice/telnyx/assistant-sync";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent?.telnyxAssistantId) throw new Error("agent or telnyxAssistantId missing");

  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const config = parseVoiceAgentConfig(runtime || agent.draftConfig);
  const result = await syncTelnyxAssistant(WORKSPACE_ID, agent, config);
  console.log("syncTelnyxAssistant:", JSON.stringify(result, null, 2));
  console.log("\nRe-run: npx tsx scripts/read-live-telnyx-voice-booking-tool-schema.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
