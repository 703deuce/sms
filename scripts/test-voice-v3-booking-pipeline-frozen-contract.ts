/**
 * Frozen Voice V3 PSTN Microsoft booking pipeline contract (no HTTP/DB).
 *
 * @see docs/VOICE-V3-PSTN-BOOKING-PIPELINE-FROZEN.md
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  VOICE_V3_BOOKING_FROZEN_SOURCE_FILES,
  VOICE_V3_BOOKING_FROZEN_TOOL_CHAIN,
  VOICE_V3_BOOKING_PIPELINE_ID,
  VOICE_V3_BOOKING_FROZEN_REVISION,
} from "../src/lib/voice-v3/frozen-booking-pipeline";
import { VOICE_V3_PROHIBITED_IMPORT_MARKERS } from "../src/lib/voice-v3/pipeline-boundary";
import { getVoiceTool } from "../src/lib/voice-v3/tools/registry";

const ROOT = process.cwd();

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTsFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function read(rel: string): string {
  const abs = join(ROOT, rel);
  assert.ok(existsSync(abs), `missing frozen file: ${rel}`);
  return readFileSync(abs, "utf8");
}

assert.equal(VOICE_V3_BOOKING_PIPELINE_ID, "voice_v3_pstn_booking_microsoft_v1");
assert.ok(VOICE_V3_BOOKING_FROZEN_REVISION.length > 0);

for (const rel of VOICE_V3_BOOKING_FROZEN_SOURCE_FILES) {
  assert.ok(existsSync(join(ROOT, rel)), `frozen source missing: ${rel}`);
}

const webhook = read("src/lib/voice-v3-basic/openai-live-webhook.ts");
assert.ok(
  webhook.includes("resolveVoiceV3AgentConfigForAgent"),
  "PSTN accept must resolve wizard-published config for bound agent",
);
assert.ok(webhook.includes("createVoiceV3CallRuntime"), "PSTN accept must create V3 runtime");

const bookTool = read("src/lib/voice-v3/tools/book-appointment-tool.ts");
assert.ok(bookTool.includes("dispatchBookingIfRequired"), "book_appointment must dispatch frozen book-dispatch");

const findTool = read("src/lib/voice-v3/tools/find-availability-tool.ts");
assert.ok(
  findTool.includes("SCHEDULING_PREFERENCE_REQUIRED"),
  "find_availability must require normalized scheduling preference",
);

const bookDispatch = read("src/lib/voice-v3/calendar/book-dispatch.ts");
assert.ok(bookDispatch.includes("BOOKING_REVALIDATION"), "book-dispatch must revalidate before commit");
assert.ok(bookDispatch.includes("BOOKING_CONFIRMED") || bookDispatch.includes("markBookingConfirmed"));

const msCreate = read("src/lib/voice-v3/calendar/microsoft/microsoft-create-booking.ts");
for (const marker of VOICE_V3_PROHIBITED_IMPORT_MARKERS) {
  assert.ok(!msCreate.includes(marker), `microsoft-create-booking must not import ${marker}`);
}

const msFind = read("src/lib/voice-v3/calendar/microsoft/microsoft-find-availability.ts");
for (const marker of VOICE_V3_PROHIBITED_IMPORT_MARKERS) {
  assert.ok(!msFind.includes(marker), `microsoft-find-availability must not import ${marker}`);
}

const runtime = read("src/lib/voice-v3/state/call-runtime.ts");
assert.ok(
  runtime.includes("VOICE_V3_BOOKING_PIPELINE_ACTIVE"),
  "runtime must log booking pipeline active",
);
assert.ok(runtime.includes("pipeline_id"), "runtime must log frozen pipeline_id");

for (const name of VOICE_V3_BOOKING_FROZEN_TOOL_CHAIN) {
  assert.ok(getVoiceTool(name), `registry must expose frozen tool ${name}`);
}

const isolationRoots = [
  join(ROOT, "src/lib/voice-v3/calendar"),
  join(ROOT, "src/lib/voice-v3/tools"),
];
for (const dir of isolationRoots) {
  for (const file of walkTsFiles(dir)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    for (const marker of VOICE_V3_PROHIBITED_IMPORT_MARKERS) {
      assert.ok(!content.includes(marker), `${rel} must not import leaked pipeline "${marker}"`);
    }
  }
}

console.log(
  `PASS voice-v3-booking-pipeline-frozen-contract (${VOICE_V3_BOOKING_PIPELINE_ID} @ ${VOICE_V3_BOOKING_FROZEN_REVISION})`,
);
