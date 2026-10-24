#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { ODD_INTAKE_HARNESS_AGENT_CONFIG } from "../../scripts/fixtures/voice-v3-odd-intake-harness-config";
import { createInitialVoiceV3CallContext } from "@/lib/server/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "@/lib/server/voice-v3/time/call-clock";
import { deriveIntakeObjective } from "@/lib/server/voice-v3/intake-objective";
import { mergeDialogActiveGoalFromOperation } from "@/lib/server/voice-v3/intake/merge-intake-state";

const config = ODD_INTAKE_HARNESS_AGENT_CONFIG;
const clock = buildVoiceV3CallClock(config.timezone);
const ctx = createInitialVoiceV3CallContext({
  callId: "call_op",
  liveSessionId: "live_op",
  clock,
});

assert.deepEqual(deriveIntakeObjective(config, ctx, "send_booking_link").missingRequiredFields.sort(), [
  "email",
  "mothers_name",
  "name",
].sort());

const withGoal = mergeDialogActiveGoalFromOperation(ctx, "send_booking_link");
assert.equal(withGoal.dialog.activeGoal, "BOOK_APPOINTMENT");

console.log("PASS get_intake_state operation intent routing");
