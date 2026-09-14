#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handlers = readFileSync("src/lib/messaging/telnyx/webhook-handlers.ts", "utf8");
assert.ok(handlers.includes("deferMctbLeadRecoveryInboundReply"));
assert.ok(handlers.includes("mctbLeadRecoveryDeferred"));
assert.ok(handlers.includes("deferMctbLeadRecoveryInboundReply(async () =>"));

const defer = readFileSync("src/lib/mctb/messaging/defer-lead-recovery-inbound-reply.ts", "utf8");
assert.ok(defer.includes("after("));

console.log("test-mctb-defer-lr-inbound: ok");
