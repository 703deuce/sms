#!/usr/bin/env npx tsx
/**
 * Master receptionist variation harness — messy caller patterns at scale.
 *
 * Runs curated + generated variations against the same production workflow runtime
 * as live phone calls (real LLM tool loop, no STT/TTS).
 *
 * Examples:
 *   npm run test:amy-master-receptionist-variations
 *   npm run test:amy-master-receptionist-variations -- --variation=var-booking-slot-change
 *   npm run test:amy-master-receptionist-variations -- --curated-only
 *   npm run test:amy-master-receptionist-variations -- --sample=50
 */
import {
  createPreprodTenant,
  cleanupPreprodTenant,
} from "../src/lib/voice/testing/preprod-harness";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import {
  buildVariationBatch,
  DEFAULT_VARIATION_BATCH_SIZE,
  getMasterReceptionistVariation,
  listCuratedVariationIds,
  runMasterReceptionistVariation,
  summarizeVariationReports,
  type MasterReceptionistVariation,
  type VariationCategory,
} from "../src/lib/voice/testing/master-receptionist-variations";
import { hasLlmConfigured } from "../src/lib/ai/llm-providers";

function parseArg(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1);
}

function parseCategories(): VariationCategory[] | undefined {
  const raw = parseArg("--category");
  if (!raw) return undefined;
  return raw.split(",").map((c) => c.trim()) as VariationCategory[];
}

function buildRunList(): MasterReceptionistVariation[] {
  const variationId = parseArg("--variation");
  if (variationId) {
    return [getMasterReceptionistVariation(variationId)];
  }

  const curatedOnly = process.argv.includes("--curated-only");
  const sampleArg = parseArg("--sample");
  const generatedArg = parseArg("--generated");

  let generatedCount = 0;
  if (sampleArg) {
    const sample = Number(sampleArg);
    if (!Number.isFinite(sample) || sample < 1) {
      throw new Error(`Invalid --sample value: ${sampleArg}`);
    }
    generatedCount = Math.max(0, sample - listCuratedVariationIds().length);
  } else if (generatedArg) {
    generatedCount = Number(generatedArg);
    if (!Number.isFinite(generatedCount) || generatedCount < 0) {
      throw new Error(`Invalid --generated value: ${generatedArg}`);
    }
  } else if (!curatedOnly) {
    generatedCount = Math.max(0, DEFAULT_VARIATION_BATCH_SIZE - listCuratedVariationIds().length);
  }

  return buildVariationBatch({
    curated: true,
    generatedCount: curatedOnly ? 0 : generatedCount,
    categories: parseCategories(),
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!hasLlmConfigured()) {
    console.error("OPENAI_API_KEY or DEEPSEEK_API_KEY is required for variation harness");
    process.exit(1);
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  const useLlmCaller = process.argv.includes("--llm-caller");
  const variations = buildRunList();
  const stopOnFail =
    process.argv.includes("--stop-on-fail") ||
    (variations.length === 1 && !process.argv.includes("--continue-on-fail"));

  console.log("Amy master receptionist variation harness");
  console.log(`Variations: ${variations.length}`);
  console.log(`Caller mode: ${useLlmCaller ? "LLM" : "scripted"}`);
  console.log(`Stop on first failure: ${stopOnFail}\n`);

  const results = [];

  for (let i = 0; i < variations.length; i++) {
    const variation = variations[i]!;
    const callerPhone = `+1571577${String(Date.now() + i).slice(-4)}`;
    const ctx = await createPreprodTenant();

    console.log(`\n── Variation ${i + 1}/${variations.length}: ${variation.id} ──`);
    console.log(variation.description);

    try {
      const { result } = await runMasterReceptionistVariation({
        variation,
        ctx,
        callerPhone,
        llmCaller: useLlmCaller,
      });
      results.push(result);

      if (result.steps?.length) {
        for (const step of result.steps) {
          const status = step.passed ? "PASS" : "FAIL";
          console.log(`  ${status}  ${step.scenarioId} (${step.turns} turns)`);
        }
      }

      const status = result.passed ? "PASS" : "FAIL";
      console.log(`${status}  ${variation.id} (${result.turns} turns)`);
      for (const failure of result.failures) {
        console.error(`       - ${failure}`);
      }

      if (!result.passed && stopOnFail) break;
    } finally {
      await cleanupPreprodTenant(ctx);
    }
  }

  const summary = summarizeVariationReports(results);

  console.log("\n══ Variation Harness Summary ══");
  console.log(`Passed: ${summary.passedCount}/${summary.total}`);

  if (!summary.passed) {
    console.error("\nFailed variations:");
    for (const failed of summary.failed) {
      console.error(`  - ${failed.variationId}: ${failed.failures.join("; ")}`);
    }
    process.exit(1);
  }

  console.log("\nAll variations passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
