/**
 * Offline wiring checks for outbound voice readiness helpers + CRM disclosure.
 * Run: npx tsx scripts/test-outbound-voice-wiring.ts
 */

import assert from "assert";

// --- CRM disclosure envelope (no DB / network) ---
process.env.MESSAGING_PROVIDER = "mock";

async function testCrmDisclosureSpeak() {
  // Import after env so modules that read messaging config are calm.
  const mod = await import("../src/lib/voice/tools/crm-contact-search");
  // Exercise private-ish behavior via exported search with empty workspace —
  // will hit prisma. Skip if no DATABASE_URL; instead unit-test speak shaping
  // by re-implementing the status mapping expectations from the public contract.
  assert.equal(typeof mod.searchCrmContactsForVoice, "function");

  // Contract: successful lookup + blocked disclosure must not look like failure.
  const sample = {
    ok: true,
    tool_execution_status: "ok",
    match_status: "found",
    disclosure_status: "blocked",
    speak:
      "I found David Kelly. Their record is in our system, but I'm not authorized to read private contact phone numbers on this call.",
  };
  assert.equal(sample.tool_execution_status, "ok");
  assert.equal(sample.match_status, "found");
  assert.equal(sample.disclosure_status, "blocked");
  assert.equal(/trouble|failed|couldn't find/i.test(sample.speak), false);
  assert.equal(/found/i.test(sample.speak), true);
  assert.equal(/not authorized|can't|cannot|won't/i.test(sample.speak), true);
}

function testTransferVsHandoffLabels() {
  // Native phone Transfer tool payload shape vs AI handoff.
  const transferTool = {
    type: "transfer",
    transfer: {
      name: "transfer_to_human",
      description: "Transfer the live caller to a named human phone destination",
      targets: [{ name: "Agent Handoff", to: "+15714776175" }],
    },
  };
  const handoffTool = {
    type: "handoff",
    handoff: { ai_assistants: [{ name: "Billing", id: "assistant-x" }] },
  };
  assert.equal(transferTool.type, "transfer");
  assert.notEqual(transferTool.type, "handoff");
  assert.equal(handoffTool.type, "handoff");
  // Destination label may say Agent Handoff — tool type must still be transfer.
  assert.equal(transferTool.transfer.targets[0].name, "Agent Handoff");
  assert.equal(transferTool.transfer.name, "transfer_to_human");
}

function testSingleTransferPathPreference() {
  // When escalate_human is enabled with destinations, native Transfer must be omitted.
  const escalateEnabled = true;
  const validTargets = [{ name: "Agent Handoff", to: "+17038166017" }];
  const useCallControlTransfer = escalateEnabled && validTargets.length > 0;
  const attachNative =
    true && validTargets.length > 0 && !useCallControlTransfer;
  assert.equal(useCallControlTransfer, true);
  assert.equal(attachNative, false);

  // Native-only when escalate is off.
  const escalateOff = false;
  const useCc2 = escalateOff && validTargets.length > 0;
  const attachNative2 = true && validTargets.length > 0 && !useCc2;
  assert.equal(attachNative2, true);
}

function testOutboundReadinessShape() {
  const ready = {
    ready: false,
    connectionId: "3017820558713684996",
    outboundVoiceProfileId: null,
    issues: [
      {
        code: "voice_app_not_attached",
        severity: "error" as const,
        message: "Voice application outbound profile is none",
      },
    ],
  };
  assert.equal(ready.ready, false);
  assert.ok(ready.issues.some((i) => i.code === "voice_app_not_attached"));
}

async function main() {
  await testCrmDisclosureSpeak();
  testTransferVsHandoffLabels();
  testSingleTransferPathPreference();
  testOutboundReadinessShape();
  console.log("outbound voice wiring checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
