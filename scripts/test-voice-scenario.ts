#!/usr/bin/env npx tsx
/**
 * Run a single headless scenario by name.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-scenario.ts booking-link-two-turn
 */
import fs from "node:fs";
import path from "node:path";
import { hasLlmConfigured } from "@/lib/ai/llm-providers";
import {
  runHeadlessScenario,
  runBookingLinkTwoTurnScenario,
  printScenarioResult,
} from "../src/lib/voice/testing/headless/conversation-driver";
import {
  cleanupHeadlessFixture,
  seedWoodbridgeHeadlessFixture,
} from "../src/lib/voice/testing/headless/woodbridge-fixture";

async function main() {
  const name = process.argv[2] || "booking-link-two-turn";
  if (!hasLlmConfigured()) {
    console.error("Set OPENAI_API_KEY or DEEPSEEK_API_KEY.");
    process.exit(1);
  }

  const fixture = await seedWoodbridgeHeadlessFixture();
  try {
    let result;
    if (name === "booking-link-two-turn") {
      result = await runBookingLinkTwoTurnScenario(fixture);
    } else {
      const file = path.join(process.cwd(), "tests/voice/scenarios", `${name}.json`);
      if (!fs.existsSync(file)) {
        console.error(`Unknown scenario: ${name} (no file ${file})`);
        process.exit(1);
      }
      const def = JSON.parse(fs.readFileSync(file, "utf8")) as {
        name: string;
        turns: Array<{ caller: string }>;
        expect?: { tools?: Array<{ type: string }>; forbiddenTools?: string[] };
      };
      result = await runHeadlessScenario({
        fixture,
        name: def.name,
        callerTurns: def.turns.map((t) => t.caller),
        expectSendResource: def.expect?.tools?.some((t) => t.type === "send_resource"),
        forbidTools: def.expect?.forbiddenTools,
      });
    }
    printScenarioResult(result);
    process.exit(result.passed ? 0 : 1);
  } finally {
    await cleanupHeadlessFixture(fixture);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
