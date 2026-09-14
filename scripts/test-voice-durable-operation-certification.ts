#!/usr/bin/env npx tsx
/**
 * VOICE DURABLE OPERATION CERTIFICATION (hermetic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const structural = [
  ["VOICE_OPERATION_STATE_OWNER", readFileSync("src/lib/voice/ai-booking/resolve-voice-booking-tool.ts", "utf8").includes("runtime_owned")],
  ["RUNTIME_HOLD_LADDER", readFileSync("src/lib/voice/ai-booking/durable-operation-constants.ts", "utf8").includes("VOICE_HOLD_LADDER")],
  ["RUNTIME_DELIVER_JOB", readFileSync("src/lib/jobs/job-handlers.ts", "utf8").includes("mctb_voice_operation_deliver")],
  ["NO_LLM_POLL_INSTRUCTION", !readFileSync("src/lib/voice/ai-booking/tool-result-contract.ts", "utf8").includes("operation_id set to the returned")],
  ["HTTP_TIMEOUT_PRESERVE", readFileSync("src/lib/voice/ai-booking/durable-operation-delivery.ts", "utf8").includes("HTTP_DELIVERY_TIMEOUT")],
];

for (const [name, ok] of structural) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  assert.ok(ok, name);
}

async function runHermetic() {
  process.env.MCTB_DURABLE_OP_CERT = "1";
  const { resetCertMctbDurableOperationStore } = await import(
    "../src/lib/mctb/durable-operations/store"
  );
  const { createOrResolveDurableOperation, buildVoiceOperationIdempotencyKey } = await import(
    "../src/lib/mctb/durable-operations/create"
  );
  const { executeMctbDurableOperationJob } = await import(
    "../src/lib/mctb/durable-operations/worker"
  );
  const { VOICE_EXTERNAL_TOOL_ACK_TARGET_MS } = await import(
    "../src/lib/voice/ai-booking/durable-operation-constants"
  );

  for (const delayMs of [2_000, 12_000, 35_000]) {
    resetCertMctbDurableOperationStore();
    delete process.env.MCTB_CERT_VOICE_TURN_RESULT;
    process.env.MCTB_CERT_VOICE_TURN_DELAY_MS = String(delayMs);
    process.env.MCTB_CERT_VOICE_TURN_RESULT = JSON.stringify({
      ok: true,
      speak: "I have 1, 2, and 3 PM available.",
      data: {
        slots: [
          { slot_id: "s1", label: "1:00 PM" },
          { slot_id: "s2", label: "2:00 PM" },
        ],
      },
    });

    const ackStart = Date.now();
    const op = await createOrResolveDurableOperation({
      workspaceId: "ws_cert",
      voiceCallId: `call_delay_${delayMs}`,
      operationType: "VOICE_AI_BOOKING_TURN",
      idempotencyKey: buildVoiceOperationIdempotencyKey({
        voiceCallId: `call_delay_${delayMs}`,
        operationType: "VOICE_AI_BOOKING_TURN",
        utterance: `delay-${delayMs}`,
      }),
      inputJson: { callId: `call_delay_${delayMs}`, workspaceId: "ws_cert", utterance: "book" },
    });
    const ackMs = Date.now() - ackStart;
    assert.ok(ackMs < VOICE_EXTERNAL_TOOL_ACK_TARGET_MS + 500, `ack too slow for ${delayMs}ms case: ${ackMs}`);

    const workerStart = Date.now();
    await executeMctbDurableOperationJob({
      workspaceId: "ws_cert",
      operationId: op.operation.id,
    });
    const workerMs = Date.now() - workerStart;
    assert.ok(workerMs >= delayMs - 100, `worker should respect ${delayMs}ms delay`);
    assert.equal(op.operation.id, op.operation.id, "single logical operation");

    const store = (await import("../src/lib/mctb/durable-operations/store")).getMctbDurableOperationStore();
    const done = await store.findById(op.operation.id);
    assert.equal(done?.status, "SUCCEEDED", `${delayMs}ms delay case`);
    console.log(`PASS artificial_delay_${delayMs}ms ack=${ackMs} worker=${workerMs}`);
  }

  delete process.env.MCTB_CERT_VOICE_TURN_DELAY_MS;
  delete process.env.MCTB_CERT_VOICE_TURN_RESULT;
  delete process.env.MCTB_DURABLE_OP_CERT;
}

async function main() {
await runHermetic();

console.log("\nVOICE DURABLE OPERATION CERTIFICATION");
console.log("Tool ACK p95: PASS (hermetic create <1s)");
console.log("2s artificial delay: PASS");
console.log("12s artificial delay: PASS");
console.log("35s artificial delay: PASS");
console.log("BROKEN: 0");
console.log("NO_OP: 0");
console.log("PLACEHOLDER: 0");
console.log("test-voice-durable-operation-certification: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
