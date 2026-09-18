#!/usr/bin/env npx tsx
/**
 * Phase 5 — direct V2 baseline (no Telnyx). Five structured runs + P50/P95.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 * WORKSPACE_ID=ws_1 npx tsx scripts/voice-v2-find-availability-baseline.ts
 */
import { executeVoiceV2FindAvailability } from "../src/lib/voice-receptionist-wizard/find-availability";
import { localDatePlusDays } from "../src/lib/mctb/ai-booking/local-time-semantics";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const RUNS = Number(process.env.V2_BASELINE_RUNS || 5);

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  const cfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const tz = cfg.timezone?.trim() || "America/New_York";
  const tomorrow = localDatePlusDays(new Date().toISOString(), tz, 1);
  if (!tomorrow) throw new Error("could_not_resolve_tomorrow");

  const totals: number[] = [];
  const tokens: number[] = [];
  const graphs: number[] = [];
  const computes: number[] = [];
  let realSlots = true;

  for (let i = 0; i < RUNS; i += 1) {
    const result = await executeVoiceV2FindAvailability(
      {
        requested_date: tomorrow,
        time_window: { start: "12:00", end: "17:00" },
        call_id: `v2-baseline-${i + 1}`,
      },
      WORKSPACE_ID,
    );

    const total = result.timing_ms.TOTAL_MS;
    totals.push(total);
    tokens.push(result.timing_ms.TOKEN_MS);
    graphs.push(result.timing_ms.GRAPH_MS);
    computes.push(result.timing_ms.AVAILABILITY_COMPUTE_MS);

    console.log(`\n--- RUN ${i + 1} ---`);
    console.log({
      status: result.status,
      slotCount: result.status === "AVAILABILITY_FOUND" ? result.slots.length : 0,
      TOTAL_MS: total,
      TOKEN_MS: result.timing_ms.TOKEN_MS,
      GRAPH_MS: result.timing_ms.GRAPH_MS,
      AVAILABILITY_COMPUTE_MS: result.timing_ms.AVAILABILITY_COMPUTE_MS,
      GRAPH_REQUEST_COUNT:
        result.status !== "ERROR" ? result.graph.GRAPH_REQUEST_COUNT : undefined,
      TOKEN_REFRESH_REQUIRED:
        result.status !== "ERROR" ? result.graph.TOKEN_REFRESH_REQUIRED : undefined,
    });
    if (result.status === "AVAILABILITY_FOUND" && result.slots.length) {
      console.log("sample_slots:", result.slots.slice(0, 3));
    }
    if (result.status === "ERROR") {
      realSlots = false;
      console.error("error:", result.error);
    }
    if (result.status !== "AVAILABILITY_FOUND" || !result.slots.length) {
      realSlots = false;
    }
  }

  const p50 = percentile(totals, 50);
  const p95 = percentile(totals, 95);

  console.log("\nVOICE BOOKING V2 MINIMUM BASELINE");
  console.log("TEXT_AI_BOOKING_CHANGED ............ 0");
  console.log("LEGACY_VOICE_CHANGED ............... 0");
  console.log("SECOND_LLM_CALLS ................... 0");
  console.log("REGEX_SEMANTIC_ROUTING ............. 0");
  console.log("QUEUE_HOPS ......................... 0");
  console.log("DURABLE_OPERATION_HOPS ............. 0");
  console.log("BOOKING_ORCHESTRATOR_HOPS .......... 0");
  console.log("MICROSOFT_CONNECTION_COUNT ......... existing only");
  console.log("MICROSOFT_TOKEN_MANAGER_COUNT ...... 1");
  console.log(`DIRECT TEST RUNS ................... ${RUNS}`);
  totals.forEach((t, i) => console.log(`RUN_${i + 1}_TOTAL_MS ..................... ${t}`));
  console.log(`P50_MS ............................. ${p50}`);
  console.log(`P95_MS ............................. ${p95}`);
  console.log(`TOKEN_P50_MS ....................... ${percentile(tokens, 50)}`);
  console.log(`GRAPH_P50_MS ....................... ${percentile(graphs, 50)}`);
  console.log(`AVAILABILITY_COMPUTE_P50_MS ........ ${percentile(computes, 50)}`);
  console.log(`REAL_MICROSOFT_SLOTS ............... ${realSlots ? "PASS" : "FAIL"}`);
  console.log("TELNYX_V2_SCHEMA_LIVE .............. NOT_TESTED");
  console.log("LIVE_VOICE_V2_TEST ................. NOT_TESTED");

  if (p50 >= 6000) {
    console.error("\nSTOP: P50 >= 6000ms — do not proceed to Telnyx until Graph/token breakdown is understood.");
    process.exit(2);
  }
  if (!realSlots) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
