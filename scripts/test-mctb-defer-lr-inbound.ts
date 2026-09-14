#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handlers = readFileSync("src/lib/messaging/telnyx/webhook-handlers.ts", "utf8");
assert.ok(handlers.includes("await handleMctbCustomerSmsReply"));
assert.ok(!handlers.includes("deferMctbLeadRecoveryInboundReply"));

const lock = readFileSync("src/lib/mctb/lead-recovery/cross-worker-lock.ts", "utf8");
assert.ok(!lock.includes("pg_advisory_xact_lock"));
assert.ok(lock.includes("withLeadRecoveryConversationLock"));

console.log("test-mctb-lr-inbound-webhook-path: ok");
