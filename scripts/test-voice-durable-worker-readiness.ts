#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handlers = readFileSync("src/lib/jobs/job-handlers.ts", "utf8");
const bullmq = readFileSync("src/lib/jobs/bullmq.ts", "utf8");
const priority = readFileSync("src/lib/jobs/job-priority.ts", "utf8");
const compat = readFileSync("src/lib/supabase/prisma-compat.ts", "utf8");

const requiredJobs = [
  "mctb_durable_operation_process",
  "mctb_voice_operation_hold_tick",
  "mctb_voice_operation_deliver",
];

for (const job of requiredJobs) {
  assert.ok(handlers.includes(job), `${job} handler`);
  assert.ok(priority.includes(job), `${job} priority`);
}

assert.ok(bullmq.includes("VOICE_DISPATCH_BULLMQ_QUEUES"));
assert.ok(bullmq.includes('"voice-calls"'));
assert.ok(
  bullmq.includes("...VOICE_DISPATCH_BULLMQ_QUEUES"),
  "voice-calls must be started by startSmsDispatchBullmqWorkers",
);
assert.ok(compat.includes("mctbDurableOperation"), "Supabase compat must map durable operations table");

console.log("PASS all voice durable job handlers registered");
console.log("PASS voice-calls on dispatch worker BullMQ queues");
console.log("PASS mctbDurableOperation Supabase compat mapping");
console.log("test-voice-durable-worker-readiness: ok (structural)");
