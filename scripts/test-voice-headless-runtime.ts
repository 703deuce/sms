#!/usr/bin/env npx tsx
/**
 * Level A — voice runtime / tool certification (no LLM).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-headless-runtime.ts
 */
import {
  certifySendResourcePhrases,
  certifySendResourceRuntime,
} from "../src/lib/voice/testing/headless/runtime-cert";
import {
  cleanupHeadlessFixture,
  seedWoodbridgeHeadlessFixture,
} from "../src/lib/voice/testing/headless/woodbridge-fixture";

async function main() {
  const fixture = await seedWoodbridgeHeadlessFixture();
  try {
    const core = await certifySendResourceRuntime(fixture);
    if (!core.passed) {
      console.error("VOICE HEADLESS RUNTIME — FAIL");
      for (const e of core.errors) console.error(" -", e);
      process.exit(1);
    }
    console.log("send_resource runtime: PASS");

    const phrases = await certifySendResourcePhrases(fixture);
    console.log(
      `send_resource webhook phrases: ${phrases.passed}/${phrases.passed + phrases.failed} PASS`,
    );
    if (phrases.failed > 0) {
      for (const d of phrases.details) console.error(" -", d);
      process.exit(1);
    }

    console.log("\nVOICE HEADLESS RUNTIME CERTIFICATION: PASS");
  } finally {
    await cleanupHeadlessFixture(fixture);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
