/**
 * Regression: Voice V3 must not import removed Voice V2 booking runtime.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  VOICE_V3_PIPELINE_SCAN_ROOTS,
  VOICE_V3_PROHIBITED_IMPORT_MARKERS,
  VOICE_V3_PROHIBITED_LIVE_TOOL_NAMES,
} from "../src/lib/voice-v3/pipeline-boundary";
import { buildVoiceV3AstraDelegationResponses } from "../src/lib/voice-v3/intake/delegation-config";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";

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

for (const root of VOICE_V3_PIPELINE_SCAN_ROOTS) {
  const abs = join(SRC, root);
  for (const file of walkTsFiles(abs)) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    if (rel.endsWith("pipeline-boundary.ts")) continue;
    const content = readFileSync(file, "utf8");
    for (const marker of VOICE_V3_PROHIBITED_IMPORT_MARKERS) {
      assert.ok(
        !content.includes(marker),
        `${rel} must not reference removed path "${marker}"`,
      );
    }
  }
}

const prompts = buildVoiceV3Prompts(resolveVoiceV3DefaultPromptInput(new Date()));
const delegation = buildVoiceV3AstraDelegationResponses(prompts.astraInstructions);
const toolsJson = JSON.stringify(delegation.tools ?? []);
for (const banned of VOICE_V3_PROHIBITED_LIVE_TOOL_NAMES) {
  assert.ok(!toolsJson.includes(banned), `delegation must not expose legacy tool "${banned}"`);
}
const LEGACY_REMOVED_MARKERS = [
  "apply-extracted-meaning",
  "emit-caller-meaning-tool",
  "live-speak-sync",
  "semantic-extraction-retry",
  "direct-caller-meaning-extraction",
  "parse-astra-meaning-response",
];
for (const root of VOICE_V3_PIPELINE_SCAN_ROOTS) {
  const abs = join(SRC, root);
  for (const file of walkTsFiles(abs)) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    for (const marker of LEGACY_REMOVED_MARKERS) {
      assert.ok(!content.includes(marker), `${rel} must not import removed legacy module "${marker}"`);
    }
  }
}

for (const required of [
  "update_intake",
  "find_availability",
  "book_appointment",
  "find_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "transfer_call",
  "end_call",
]) {
  assert.ok(toolsJson.includes(required), `delegation must expose capability tool "${required}"`);
}

console.log("PASS voice-v3 pipeline boundary");
