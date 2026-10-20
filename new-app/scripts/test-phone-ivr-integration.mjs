#!/usr/bin/env node
/**
 * Phone ↔ Conversational IVR integration checks (static / no DB).
 * Run: node new-app/scripts/test-phone-ivr-integration.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(dir, rel), "utf8");

const hydrate = read("../lib/server/receptionist/hydrate-conversational-routes-from-phone.ts");
assert.ok(hydrate.includes("getForwardingConfig"), "hydrate loads Phone forwarding config");
assert.ok(hydrate.includes("publishRingGroupPlan"), "hydrate builds ring group plan");

const agentService = read("../lib/server/receptionist/agent-service.ts");
assert.ok(
  agentService.includes("hydrateConversationalRoutesFromPhone"),
  "publish calls hydrate before validation",
);

const compileTransfer = read("../lib/server/receptionist/compile-transfer-from-editor.ts");
assert.ok(compileTransfer.includes("publishRingGroupPlan"), "compile expands ring group members");
assert.ok(compileTransfer.includes("usesWaterfall"), "multi-member routes use waterfall");

const compileRuntime = read("../lib/server/receptionist/compile-runtime.ts");
assert.ok(
  compileRuntime.includes("simultaneous"),
  "publish blocks simultaneous ring groups on IVR",
);

const calls = read("../lib/server/phone/calls-service.ts");
assert.ok(calls.includes("finalizeWebRtcClientHangup"), "webrtc client hangup finalizer exists");
assert.ok(calls.includes("powerDialerAttemptId"), "power dialer attempt released on client hangup");

const api = read("../app/api/phone/calls/route.ts");
assert.ok(api.includes("webrtc_finalize"), "webrtc_finalize API action");

console.log("PASS test-phone-ivr-integration");
