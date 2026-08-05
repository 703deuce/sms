/**
 * Lightweight regression checks for inbound call E2E plumbing.
 * Run: npx tsx scripts/test-inbound-e2e-plumbing.ts
 */

import assert from "node:assert/strict";
import { mapTexmlCallStatus } from "../src/lib/voice/telnyx/texml-status-callback";

function testTexmlStatusMap() {
  assert.equal(mapTexmlCallStatus("initiated"), "call.initiated");
  assert.equal(mapTexmlCallStatus("ringing"), "call.ringing");
  assert.equal(mapTexmlCallStatus("in-progress"), "call.answered");
  assert.equal(mapTexmlCallStatus("answered"), "call.answered");
  assert.equal(mapTexmlCallStatus("completed"), "call.hangup");
  assert.equal(mapTexmlCallStatus("no-answer"), "call.hangup");
  assert.equal(mapTexmlCallStatus("busy"), "call.hangup");
  console.log("ok mapTexmlCallStatus");
}

async function testRunnerContinuesIntoWait() {
  const src = await import("fs").then((fs) =>
    fs.readFileSync("src/lib/automations/runner.ts", "utf8"),
  );
  assert.match(
    src,
    /blockType === "wait_for_call_result"/,
    "runner must continue into wait_for_call_result",
  );
  console.log("ok runner continues into wait_for_call_result");
}

async function testTexmlRegistersStatusCallback() {
  const src = await import("fs").then((fs) =>
    fs.readFileSync("src/lib/voice/telnyx/texml-direct-route.ts", "utf8"),
  );
  assert.match(src, /status_callback/);
  assert.match(src, /texmlStatusCallbackBody/);
  console.log("ok TeXML route registers status_callback");
}

async function testPublishFailClosed() {
  const src = await import("fs").then((fs) =>
    fs.readFileSync("src/lib/voice/agent-service.ts", "utf8"),
  );
  assert.match(src, /rollbackPublish/);
  assert.match(src, /TeXML route did not match live connection/);
  console.log("ok publishVoiceAgent fail-closed");
}

async function main() {
  testTexmlStatusMap();
  await testRunnerContinuesIntoWait();
  await testTexmlRegistersStatusCallback();
  await testPublishFailClosed();
  console.log("all inbound e2e plumbing checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
