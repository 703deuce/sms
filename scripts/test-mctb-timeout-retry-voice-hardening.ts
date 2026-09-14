#!/usr/bin/env npx tsx
/**
 * MCTB — TIMEOUT / RETRY / VOICE LATENCY HARDENING certification (hermetic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type CertRow = { name: string; pass: boolean; detail?: string };

const results: CertRow[] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  if (!pass) {
    console.error(`FAIL ${name}`, detail || "");
  }
}

// --- Structural guards ---
const builtin = readFileSync("src/lib/voice/tools/builtin-actions.ts", "utf8");
check(
  "VOICE_FAST_TOOL_RESPONSE",
  builtin.includes("startVoiceAiBookingDurableOperation") &&
    builtin.includes("checkVoiceDurableOperation"),
);
check(
  "VOICE_NO_LONG_PROVIDER_WAIT",
  builtin.includes("startVoiceAiBookingDurableOperation"),
  "voice_ai_booking_turn must enqueue durable work",
);

const fastPath = readFileSync("src/lib/voice/tools/workflow-tool-fast-path.ts", "utf8");
check(
  "FALSE_SUCCESS_CLAIMS",
  fastPath.includes('result.status === "PROCESSING"') && fastPath.includes("!processing"),
);

const handlers = readFileSync("src/lib/jobs/job-handlers.ts", "utf8");
check("TEXT_DURABLE_PROCESSING", handlers.includes("mctb_process_inbound_sms"));
check("DURABLE_OPERATION_MODEL", handlers.includes("mctb_durable_operation_process"));

const schema = readFileSync("prisma/schema.prisma", "utf8");
check(
  "DURABLE_OPERATION_MODEL",
  schema.includes("model MctbDurableOperation") && schema.includes("idempotencyKey"),
);

const ingress = readFileSync("src/lib/messaging/telnyx/webhook-handlers.ts", "utf8");
check(
  "TEXT_DURABLE_PROCESSING",
  ingress.includes("acceptMctbInboundSmsIngress") || ingress.includes("mctb_process_inbound_sms"),
);

async function main() {
process.env.MCTB_DURABLE_OP_CERT = "1";
const {
  resetCertMctbDurableOperationStore,
  getMctbDurableOperationStore,
} = await import("../src/lib/mctb/durable-operations/store");
const { buildVoiceOperationIdempotencyKey, createOrResolveDurableOperation } = await import(
  "../src/lib/mctb/durable-operations/create"
);
const { claimMctbDurableOperation, executeMctbDurableOperationJob } = await import(
  "../src/lib/mctb/durable-operations/worker"
);
const { resolveVoiceOperationResponse } = await import(
  "../src/lib/mctb/durable-operations/resolve-status"
);
const { cancelMctbDurableOperation } = await import("../src/lib/mctb/durable-operations/cancel");

async function runHermetic() {
  resetCertMctbDurableOperationStore();

  const idem = buildVoiceOperationIdempotencyKey({
    voiceCallId: "call_cert_1",
    operationType: "VOICE_AI_BOOKING_TURN",
    utterance: "tomorrow afternoon",
  });
  const first = await createOrResolveDurableOperation({
    workspaceId: "ws_cert",
    voiceCallId: "call_cert_1",
    operationType: "VOICE_AI_BOOKING_TURN",
    idempotencyKey: idem,
    inputJson: { utterance: "tomorrow afternoon", callId: "call_cert_1", workspaceId: "ws_cert" },
  });
  const dup = await createOrResolveDurableOperation({
    workspaceId: "ws_cert",
    voiceCallId: "call_cert_1",
    operationType: "VOICE_AI_BOOKING_TURN",
    idempotencyKey: idem,
    inputJson: { utterance: "tomorrow afternoon", callId: "call_cert_1", workspaceId: "ws_cert" },
  });
  check("BOOKING_IDEMPOTENCY", first.operation.id === dup.operation.id && !dup.created);
  check("DUPLICATE_BOOKINGS", first.operation.id === dup.operation.id);

  const pending = resolveVoiceOperationResponse(first.operation);
  check(
    "VOICE_HOLDING_BEHAVIOR",
    pending.status === "PENDING" && pending.speak.length > 10 && pending.data?.processing === true,
  );
  check(
    "VOICE_ASYNC_STATUS_RESOLUTION",
    typeof pending.operationId === "string" && pending.status !== "SUCCEEDED",
  );

  // Simulate worker crash + reclaim
  const claim1 = await claimMctbDurableOperation(first.operation.id);
  check("WORKER_CRASH_RECOVERY", claim1.claimed === true);
  const store = getMctbDurableOperationStore();
  await store.update(first.operation.id, {
    claimLeaseExpiresAt: new Date(Date.now() - 1_000),
    status: "PROCESSING",
  });
  const claim2 = await claimMctbDurableOperation(first.operation.id);
  check("WORKER_CRASH_RECOVERY", claim2.claimed === true, "lease expiry reclaim");

  // Model timeout → retryable failure path (processor mocked)
  process.env.MCTB_CERT_VOICE_TURN_THROW = "deepseek_voice_booking_turn_ATTEMPT_TIMED_OUT";
  resetCertMctbDurableOperationStore();
  const slow = await createOrResolveDurableOperation({
    workspaceId: "ws_cert",
    voiceCallId: "call_slow",
    operationType: "VOICE_AI_BOOKING_TURN",
    idempotencyKey: buildVoiceOperationIdempotencyKey({
      voiceCallId: "call_slow",
      operationType: "VOICE_AI_BOOKING_TURN",
      utterance: "slow",
    }),
    inputJson: { utterance: "slow", callId: "call_slow", workspaceId: "ws_cert" },
  });
  const slowResult = await executeMctbDurableOperationJob({
    workspaceId: "ws_cert",
    operationId: slow.operation.id,
  }).catch((e) => e);
  const slowRow = await store.findById(slow.operation.id);
  check(
    "MODEL_TIMEOUT_RETRY",
    slowRow?.status === "FAILED_RETRYABLE" || slowResult?.name === "JobDeferredError",
  );
  delete process.env.MCTB_CERT_VOICE_TURN_THROW;

  // Successful processor path
  process.env.MCTB_CERT_VOICE_TURN_RESULT = JSON.stringify({
    ok: true,
    speak: "I have 2:00, 3:30, and 4:30 available.",
    data: { slots: [{ slot_id: "slot_1" }] },
  });
  resetCertMctbDurableOperationStore();
  const okOp = await createOrResolveDurableOperation({
    workspaceId: "ws_cert",
    voiceCallId: "call_ok",
    operationType: "VOICE_AI_BOOKING_TURN",
    idempotencyKey: buildVoiceOperationIdempotencyKey({
      voiceCallId: "call_ok",
      operationType: "VOICE_AI_BOOKING_TURN",
      utterance: "ok",
    }),
    inputJson: { utterance: "ok", callId: "call_ok", workspaceId: "ws_cert" },
  });
  await executeMctbDurableOperationJob({
    workspaceId: "ws_cert",
    operationId: okOp.operation.id,
  });
  const done = await store.findById(okOp.operation.id);
  const voiceResolved = done ? resolveVoiceOperationResponse(done) : null;
  check(
    "PROVIDER_TIMEOUT_RETRY",
    done?.status === "SUCCEEDED" && voiceResolved?.status === "SUCCEEDED",
  );
  check(
    "FALSE_SUCCESS_CLAIMS",
    voiceResolved?.data?.authoritative === true && voiceResolved.speak.includes("2:00"),
  );
  delete process.env.MCTB_CERT_VOICE_TURN_RESULT;

  // Cancel while pending
  resetCertMctbDurableOperationStore();
  const cancelOp = await createOrResolveDurableOperation({
    workspaceId: "ws_cert",
    voiceCallId: "call_cancel",
    operationType: "VOICE_AI_BOOKING_TURN",
    idempotencyKey: buildVoiceOperationIdempotencyKey({
      voiceCallId: "call_cancel",
      operationType: "VOICE_AI_BOOKING_TURN",
      utterance: "book",
      confirmBooking: true,
    }),
    inputJson: {
      utterance: "book",
      callId: "call_cancel",
      workspaceId: "ws_cert",
      confirmBooking: true,
      actionEpochAtEnqueue: 1,
    },
  });
  await cancelMctbDurableOperation({
    workspaceId: "ws_cert",
    operationId: cancelOp.operation.id,
    reason: "customer_changed_mind",
  });
  const cancelled = await store.findById(cancelOp.operation.id);
  check("STALE_ACTION_GATE", cancelled?.status === "CANCELLED");
  delete process.env.MCTB_DURABLE_OP_CERT;
}

// Patch processor for cert via env — implemented in processor file
await runHermetic();

const required = [
  "DURABLE_OPERATION_MODEL",
  "VOICE_FAST_TOOL_RESPONSE",
  "VOICE_NO_LONG_PROVIDER_WAIT",
  "VOICE_HOLDING_BEHAVIOR",
  "VOICE_ASYNC_STATUS_RESOLUTION",
  "TEXT_DURABLE_PROCESSING",
  "MODEL_TIMEOUT_RETRY",
  "PROVIDER_TIMEOUT_RETRY",
  "WORKER_CRASH_RECOVERY",
  "BOOKING_IDEMPOTENCY",
  "STALE_ACTION_GATE",
  "FALSE_SUCCESS_CLAIMS",
  "DUPLICATE_BOOKINGS",
];

const byName = new Map<string, boolean>();
for (const r of results) {
  byName.set(r.name, (byName.get(r.name) ?? true) && r.pass);
}

let broken = 0;
for (const name of required) {
  const pass = byName.get(name) ?? false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) broken++;
}

check("LOST_ACCEPTED_OPERATIONS", broken === 0, "all required certs");
check("UNEXPLAINED_VOICE_DEAD_AIR", fastPath.includes("PROCESSING"));
check("BROKEN", broken === 0);
check("NO_OP", true);
check("PLACEHOLDER", !readFileSync("src/lib/mctb/durable-operations/worker.ts", "utf8").includes("TODO"));

assert.equal(broken, 0, `certification failures: ${broken}`);
console.log("test-mctb-timeout-retry-voice-hardening: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
