/**
 * Unit-style checks for tool-wait commentary scheduling (no OpenAI).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-gpt-live-tool-wait-schedule.ts
 */
import assert from "node:assert/strict";

import { createLiveToolWaitProgressController } from "@/lib/voice/telnyx/openai-live-bridge/live-tool-wait-commentary";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-receptionist-wizard/telnyx-tool-definition";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const sent: string[] = [];
  const ctrl = createLiveToolWaitProgressController({
    callId: "call_test",
    liveSessionId: "live_test",
    delegationId: "deleg_test",
    toolCallId: "fn_1",
    toolName: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
    sendLiveOut: (ev) => {
      if (ev.type === "session.commentary.append") sent.push(String(ev.content));
    },
  });

  ctrl.start();
  assert.equal(sent.length, 1, "initial commentary");
  await delay(3000);
  assert.equal(sent.length, 2, "first progress ~2.8s");
  ctrl.complete();
  await delay(4000);
  assert.equal(sent.length, 2, "no commentary after complete");
  console.log("PASS gpt-live tool-wait schedule");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
