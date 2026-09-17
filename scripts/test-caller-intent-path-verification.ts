#!/usr/bin/env npx tsx
/**
 * Documents + asserts: caller fact merge is NOT gated on session.delegation.created.
 *
 * Path: transcript deltas + audio activity → LiveCallerUtteranceAssembler (stable) → syncLiveCallerUtteranceIntent
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
    "BRIDGE_UTTERANCE_ASSEMBLER",
    bridge.includes("LiveCallerUtteranceAssembler") &&
      bridge.includes("onCallerAudioEndedEstimate") &&
      bridge.includes("onTranscriptDelta"),
  );
  pass(
    "SYNC_UNIFIED_INTERPRETER",
    sync.includes("interpretStableCallerUtterance") &&
      sync.includes("applyCallerMeaningToCallContext") &&
      sync.includes("buildInterpreterContext"),
  );
  pass(
    "FULL_TRANSCRIPT_TO_INTERPRETER",
    sync.includes("fullConversationTranscript"),
  );
  pass(
    "REVISION_GUARD",
    sync.includes("shouldApplyUtteranceInterpretation"),
  );
  pass(
    "SYNC_NOT_IN_DELEGATION_HANDLER",
    !sync.includes("delegation.created"),
  );
  pass(
    "SYNC_CALLS_MERGE_VIA_APPLY",
    sync.includes("applyCallerMeaningToCallContext") &&
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
