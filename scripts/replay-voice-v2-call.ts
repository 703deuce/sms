#!/usr/bin/env tsx
/**
 * Replay ordered CallerMeaning fixtures through the production control plane.
 * Usage: npx tsx scripts/replay-voice-v2-call.ts fixtures/voice-v2/date-before-email.json
 */
import "./preload-server-only.mjs";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CallerMeaning } from "@/lib/voice-v2/caller-meaning";
import {
  VoiceV2OrchestrationHarness,
  resetOrchestrationTestWorld,
} from "@/lib/voice-v2/testing/orchestration-harness";

type ReplayFixture = {
  call_id?: string;
  steps: Array<{ label?: string; meaning: CallerMeaning; merge_policy?: "full" | "literal_facts_only" | "none" }>;
};

async function main() {
  const fixturePath = resolve(process.argv[2] || "fixtures/voice-v2/date-before-intake.json");
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as ReplayFixture;
  resetOrchestrationTestWorld();
  const callId = raw.call_id || "REPLAY_CALL";
  const h = new VoiceV2OrchestrationHarness({ callId });
  for (const step of raw.steps) {
    console.info(`\n--- replay: ${step.label ?? "step"} ---`);
    await h.mergeMeaning(step.meaning, { mergePolicy: step.merge_policy });
  }
  console.info("\nFinal snapshot:", JSON.stringify(h.snapshot(), null, 2));
  h.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
