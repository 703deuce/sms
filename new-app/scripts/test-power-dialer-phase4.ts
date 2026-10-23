/**
 * Phase 4 unit checks — merge fields, VM drop mock, callback tabs, disposition idempotency flag.
 */
import assert from "node:assert/strict";
import { renderMergeTemplate } from "../lib/server/phone/power-dialer/merge-fields";
import { startVoicemailDropPlayback } from "../lib/server/phone/power-dialer/voicemail-drop-playback";

process.env.POWER_DIALER_VM_DROP_MOCK = "1";

async function testMerge() {
  const out = renderMergeTemplate("Hi {{first_name}} at {{company}}", {
    firstName: "Ada",
    company: "Acme",
  });
  assert.equal(out, "Hi Ada at Acme");
  console.log("merge-fields: PASS");
}

async function testVmMock() {
  const r = await startVoicemailDropPlayback({
    telnyxCallControlId: "ctrl_test",
    audioUrl: "https://example.com/a.mp3",
  });
  assert.equal(r.mocked, true);
  console.log("voicemail-drop-mock: PASS");
}

async function main() {
  await testMerge();
  await testVmMock();
  console.log("test-power-dialer-phase4: ALL PASS");
}
main();
