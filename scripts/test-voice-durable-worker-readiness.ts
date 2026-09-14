#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handlers = readFileSync("src/lib/jobs/job-handlers.ts", "utf8");
const bullmq = readFileSync("src/lib/jobs/bullmq.ts", "utf8");
const priority = readFileSync("src/lib/jobs/job-priority.ts", "utf8");

assert.ok(handlers.includes("mctb_durable_operation_process"));
assert.ok(priority.includes("mctb_durable_operation_process"));
assert.ok(bullmq.includes("voice-calls"));

console.log("PASS mctb_durable_operation_process registered");
console.log("PASS voice-calls queue referenced");
console.log("(Live worker heartbeat / Redis — run on production host)");
console.log("test-voice-durable-worker-readiness: ok (structural)");
