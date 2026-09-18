/**
 * Regression: Voice V3 PSTN booking path must not import Voice V2 booking / legacy tool runtimes.
 *
 * Run: npx tsx scripts/test-voice-v3-pipeline-boundary.ts
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

function importLines(src: string): string[] {
  return src.split("\n").filter((line) => /^\s*import\s/.test(line) || /from\s+["']/.test(line));
}

for (const root of VOICE_V3_PIPELINE_SCAN_ROOTS) {
  const abs = join(SRC, root);
  const files = walkTsFiles(abs);
  assert.ok(files.length > 0, `expected TypeScript under src/${root}`);

  for (const file of files) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    for (const marker of VOICE_V3_PROHIBITED_IMPORT_MARKERS) {
      const pattern = marker.replace(/\//g, "\\/");
      assert.doesNotMatch(
        content,
        new RegExp(`from\\s+["']@?/?.*${pattern}`),
        `${rel} must not import prohibited path containing "${marker}"`,
      );
      for (const line of importLines(content)) {
        assert.ok(
          !line.includes(marker),
          `${rel} import line references prohibited "${marker}": ${line.trim()}`,
        );
      }
    }
  }
}

const prompts = buildVoiceV3Prompts(resolveVoiceV3DefaultPromptInput(new Date()));
const delegation = buildVoiceV3AstraDelegationResponses(prompts.astraInstructions);
const toolsJson = JSON.stringify(delegation.tools ?? []);
for (const banned of VOICE_V3_PROHIBITED_LIVE_TOOL_NAMES) {
  assert.ok(
    !toolsJson.includes(banned),
    `Astra delegation must not expose legacy tool name "${banned}"`,
  );
}
assert.ok(
  toolsJson.includes("emit_caller_meaning"),
  "Astra delegation must expose emit_caller_meaning only for semantic intake",
);

console.log("PASS voice-v3 pipeline boundary (no Voice V2 booking / legacy tool imports)");
