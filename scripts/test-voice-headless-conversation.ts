#!/usr/bin/env npx tsx
/**
 * Level B — real model headless conversation (production prompt + tool webhooks).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-headless-conversation.ts
 */
import { hasLlmConfigured } from "@/lib/ai/llm-providers";
import {
  runBookingLinkTwoTurnScenario,
  printScenarioResult,
} from "../src/lib/voice/testing/headless/conversation-driver";
import {
  cleanupHeadlessFixture,
  seedWoodbridgeHeadlessFixture,
} from "../src/lib/voice/testing/headless/woodbridge-fixture";

async function main() {
  if (!hasLlmConfigured()) {
    console.error("Set OPENAI_API_KEY or DEEPSEEK_API_KEY for headless model tests.");
    process.exit(1);
  }

  const fixture = await seedWoodbridgeHeadlessFixture();
  try {
    const result = await runBookingLinkTwoTurnScenario(fixture);
    printScenarioResult(result);
    if (!result.passed) {
      console.error("\nVOICE HEADLESS CONVERSATION: FAIL");
      process.exit(1);
    }
    console.log("\nVOICE HEADLESS CONVERSATION: PASS");
  } finally {
    await cleanupHeadlessFixture(fixture);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
