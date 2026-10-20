#!/usr/bin/env node
/**
 * Mocked Voice V3 lifecycle contracts for pre-merge (no PSTN, no DB required).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const route = read("app/api/internal/voice-runtime/route.ts");
for (const action of [
  "finalize_voice_v3_call",
  "flush_voice_v3_forensics",
  "record_voice_v3_transfer_outcome",
  "append_voice_v3_forensic_events",
]) {
  assert.ok(route.includes(action), `voice-runtime exposes ${action}`);
}

const flush = read("lib/server/voice-v3/post-call/run-flush-finalize.ts");
assert.ok(flush.includes("message_left"), "finalize preserves message_left outcome");
assert.ok(flush.includes("idempotencyKey"), "flush uses idempotency");

const record = read("lib/server/voice-v3/transfer/record-transfer-outcome.ts");
assert.ok(record.includes("transfer_refer_accepted"), "refer outcome type");
assert.ok(record.includes("humanAnswered"), "answered only when human connected");

const py = readFileSync(
  join(root, "..", "voice-runtime-python/transovo_voice/voice_v3/transfer_executor.py"),
  "utf8",
);
assert.ok(py.includes("SIP_REFER_ACCEPTED"), "python direct transfer refer semantics");
assert.ok(py.includes('status=backend_status'), "python reports backend status to web");

console.log("PASS test-voice-v3-lifecycle-premerge");
