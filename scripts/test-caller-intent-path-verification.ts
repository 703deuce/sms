#!/usr/bin/env npx tsx
/**
 * Documents + asserts: caller fact merge is NOT gated on session.delegation.created.
 *
 * Path: CALLER_AUDIO_ENDED_ESTIMATE → syncLiveCallerUtteranceIntent → applyCallerIntentToCallContext
 *       → mergeCallerFactsIntoCallContext (deterministic interpreter today; Astra slot later).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-caller-intent-path-verification.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function main() {
  const bridge = readFileSync(
    join(process.cwd(), "src/lib/voice/telnyx/openai-live-bridge/live-media-bridge.ts"),
    "utf8",
  );
  const sync = readFileSync(
    join(process.cwd(), "src/lib/voice/telnyx/openai-live-bridge/live-caller-intent-sync.ts"),
    "utf8",
  );

  pass(
    "BRIDGE_CALLS_SYNC_ON_AUDIO_END",
    bridge.includes("CALLER_AUDIO_ENDED_ESTIMATE") &&
      bridge.includes("syncLiveCallerUtteranceIntent"),
  );
  pass(
    "SYNC_NOT_IN_DELEGATION_HANDLER",
    !sync.includes("delegation.created"),
  );
  pass(
    "SYNC_CALLS_MERGE_VIA_APPLY",
    sync.includes("applyCallerIntentToCallContext") &&
      sync.includes("runLiveControlPlaneTurn"),
  );
  pass(
    "EARLY_TOOL_CONTEXT",
    bridge.includes("immediateLiveStart?.toolContext ?? input.toolContext"),
  );

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS caller intent path is utterance-finalized, not delegation-gated");
}

main();
