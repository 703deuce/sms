/**
 * Multi-turn intake via delegated update_intake tool (no direct semantic extraction).
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { clearCallerTurnManager } from "../src/lib/voice-v3/conversation/caller-turn-manager";
import { handleDelegatedAstraResponseEvent } from "../src/lib/voice-v3/intake/handle-delegated-meaning";
import { clearVoiceV3LiveResponseCoordinator } from "../src/lib/voice-v3/delegation/live-response-coordinator";

const NOW = new Date("2026-09-18T16:00:00.000Z");
const SESSION = "closed_loop_multi";
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function intakeArgs(partial: Record<string, unknown>): string {
  const base: Record<string, unknown> = {
    name: null,
    email: null,
    phone: null,
  };
  for (const f of CONFIG.intakeFields) {
    if (!(f.key in base)) base[f.key] = null;
  }
  return JSON.stringify({ ...base, ...partial });
}

async function applyUpdateIntake(
  outbound: Array<Record<string, unknown>>,
  callId: string,
  args: string,
): Promise<void> {
  handleDelegatedAstraResponseEvent({
    liveSessionId: SESSION,
    nested: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        id: `fc_${callId}`,
        call_id: callId,
        name: "update_intake",
        arguments: args,
      },
    },
    send: (e) => outbound.push(e),
    delegationId: `del_${callId}`,
  });
  await new Promise((r) => setTimeout(r, 40));
}

async function main() {
  clearVoiceV3CallRuntimeStore();
  clearCallerTurnManager(SESSION);
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: SESSION,
    callId: "v3:closed_loop_multi",
    config: CONFIG,
    now: NOW,
  });
  const outbound: Array<Record<string, unknown>> = [];

  await applyUpdateIntake(
    outbound,
    "t1",
    intakeArgs({
      name: "Anthony",
      email: "anthony@example.com",
      phone: "+15550100123",
    }),
  );
  const snap = runtime.getSnapshot();
  assert.equal(snap.intake.values.name?.value, "Anthony");
  assert.equal(snap.intake.values.email?.value, "anthony@example.com");

  await applyUpdateIntake(outbound, "t2", intakeArgs({ name: "Anthony Johnson" }));
  assert.equal(runtime.getSnapshot().intake.values.name?.value, "Anthony Johnson");

  assert.ok(
    outbound.some((e) => e.type === "session.thinking.append"),
    "intake objective should publish thinking context",
  );
  assert.equal(
    outbound.filter((e) => e.type === "session.commentary.append").length,
    0,
    "intake must not push speak commentary",
  );

  clearVoiceV3LiveResponseCoordinator(SESSION);
  console.log("test-voice-v3-closed-loop-intake-multiturn: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
