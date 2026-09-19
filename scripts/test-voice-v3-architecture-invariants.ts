/**
 * Phase 18 — architecture invariant scans (static).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  VOICE_V3_PIPELINE_SCAN_ROOTS,
  VOICE_V3_PROHIBITED_IMPORT_MARKERS,
} from "../src/lib/voice-v3/pipeline-boundary";
import { VOICE_TOOL_CATALOG } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const SRC = join(process.cwd(), "src");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTsFiles(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const LEGACY_ORCHESTRATION = [
  "emit-caller-meaning-tool",
  "apply-extracted-meaning",
  "direct-caller-meaning-extraction",
  "semantic-extraction-retry",
  "live-speak-sync",
  "syncPlannerSpeakToLive",
];

for (const root of VOICE_V3_PIPELINE_SCAN_ROOTS) {
  for (const file of walkTsFiles(join(SRC, root))) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    if (rel.endsWith("pipeline-boundary.ts")) continue;
    const content = readFileSync(file, "utf8");
    for (const marker of [...VOICE_V3_PROHIBITED_IMPORT_MARKERS, ...LEGACY_ORCHESTRATION]) {
      assert.ok(!content.includes(marker), `${rel} must not reference removed path "${marker}"`);
    }
  }
}

const live = buildLiveFrontendInstructions({ businessName: "Acme", agentName: "Amy" });
assert.ok(live.includes("DELEGATION POLICY"), "Live prompt must include canonical delegation policy");
assert.ok(!live.includes("update_intake"), "Live prompt must not embed Astra tool schemas");

const toolsJson = JSON.stringify(buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_TEST_CONFIG));
assert.equal(VOICE_TOOL_CATALOG.length, 8, "registry must list eight tools");

const callerTurn = readFileSync(
  join(SRC, "lib/voice-v3/conversation/caller-turn-manager.ts"),
  "utf8",
);
assert.ok(
  !callerTurn.includes("requestResponseCreate") && !callerTurn.includes("response.create"),
  "caller-turn-manager must not issue conversational response.create",
);

console.log("PASS voice-v3 architecture invariants (static)");
