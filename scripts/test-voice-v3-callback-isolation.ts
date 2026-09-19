#!/usr/bin/env npx tsx
/**
 * Voice V3 callback path must not import legacy callback executors or CRM glue.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CALLBACK_ROOT = join(process.cwd(), "src/lib/voice-v3/callback");
const FORBIDDEN = [
  "@/lib/callback-requests/service",
  "voice-receptionist-wizard/callback",
  "executeVoiceV2CreateCallbackRequest",
  "sendQuickSms",
  "sendAppointmentSms",
  "lib/campaigns/",
  "lib/mctb/",
];

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTs(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

for (const file of walkTs(CALLBACK_ROOT)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf8");
  for (const marker of FORBIDDEN) {
    assert.ok(!content.includes(marker), `${rel} must not import ${marker}`);
  }
}

const toolFile = readFileSync(
  join(process.cwd(), "src/lib/voice-v3/tools/request-callback-tool.ts"),
  "utf8",
);
assert.ok(toolFile.includes("executeRequestCallback"));
assert.ok(!toolFile.includes("createCallbackRequest"));

console.log("PASS voice-v3 callback isolation");
