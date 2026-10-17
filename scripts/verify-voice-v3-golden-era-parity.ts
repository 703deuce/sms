#!/usr/bin/env npx tsx
/**
 * Golden-era Voice V3 parity gate (static + in-process runtime checks).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/verify-voice-v3-golden-era-parity.ts
 */
import { spawnSync } from "node:child_process";

const NODE_OPTIONS = "--import ./scripts/preload-server-only.mjs";

function run(label: string, script: string): void {
  const result = spawnSync("npx", ["tsx", script], {
    env: { ...process.env, NODE_OPTIONS },
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    console.error(`FAIL ${label}\n${result.stdout}\n${result.stderr}`);
    process.exit(result.status ?? 1);
  }
  console.log(`PASS ${label}`);
}

run("delegation_runtime_hydration", "scripts/test-voice-v3-delegation-runtime-hydration.ts");
run("callback_shared_facts_transitions", "scripts/test-voice-v3-callback-shared-facts-transitions.ts");
run("callback_matrix", "scripts/test-voice-v3-callback-matrix.ts");
run("livekit_live_context_bridge", "scripts/test-voice-v3-livekit-live-context-bridge.ts");

console.log("VOICE_V3_GOLDEN_ERA_PARITY_GATE_PASS");
