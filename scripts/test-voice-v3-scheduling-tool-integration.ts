/**
 * set_scheduling_preference + find_availability executor integration (no network).
 */
import assert from "node:assert/strict";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { executeVoiceTool } from "../src/lib/voice-v3/tools/execute-voice-tool";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

async function main() {
  clearVoiceV3CallRuntimeStore();
  const liveSessionId = "live_sched_tool";
  const runtime = createVoiceV3CallRuntime({
    liveSessionId,
    callId: "call_sched_tool",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });

  const ctxBase = {
    callId: "call_sched_tool",
    liveSessionId,
    delegationId: "del_sched",
    functionCallId: "fc_find_early",
    runtime,
    tenantId: "tenant_test",
    sendContext: () => {},
  };

  const findWithoutPref = await executeVoiceTool(ctxBase, "find_availability", { service_id: null });
  assert.equal(findWithoutPref.ok, false);
  if (!findWithoutPref.ok) {
    assert.equal(findWithoutPref.code, "SCHEDULING_PREFERENCE_REQUIRED");
    assert.equal(findWithoutPref.details?.required_tool, "set_scheduling_preference");
  }

  const setResult = await executeVoiceTool(
    { ...ctxBase, functionCallId: "fc_set_1" },
    "set_scheduling_preference",
    {
      ...emptySchedulingMeaning(),
      date_relation: "NEXT_WEEKDAY",
      weekday: "TUESDAY",
      time_kind: "DAYPART",
      daypart: "AFTERNOON",
      date_expression: "next Tuesday afternoon",
      time_expression: "afternoon",
    },
  );
  assert.equal(setResult.ok, true);
  if (setResult.ok) {
    assert.equal(setResult.status, "SCHEDULING_PREFERENCE_SET");
    assert.equal(setResult.data?.ready_for_availability_search, true);
  }

  clearVoiceV3CallRuntimeStore();
  console.log("PASS voice-v3 scheduling tool integration");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
