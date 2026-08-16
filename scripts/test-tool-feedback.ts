/**
 * Tool feedback normalization tests.
 * Run: npx tsx scripts/test-tool-feedback.ts
 */
import assert from "node:assert/strict";
import {
  formatToolFeedbackForModel,
  toolFeedbackFromError,
  toolFeedbackMissingEmail,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
} from "../src/lib/voice/tool-feedback";
import { toolSuccess, toLegacyVoiceShape } from "../src/lib/voice/agent-tool-gateway/envelope";
import { AgentToolError, failResult } from "../src/lib/voice/agent-tool-gateway/errors";

const emailFb = toolFeedbackMissingEmail({ tool: "schedule_appointment", slotId: "ST_abc" });
assert.equal(emailFb.outcome, "recoverable_failure");
assert.equal(emailFb.recovery_class, "MISSING_INFORMATION");
assert.equal(emailFb.next_action, "collect_email_then_retry");

const formatted = formatToolFeedbackForModel(emailFb);
assert.match(formatted, /^TOOL_FEEDBACK: recoverable_failure/);
assert.match(formatted, /recovery_class: MISSING_INFORMATION/);
assert.match(formatted, /next_action: collect_email_then_retry/);
assert.match(formatted, /next_action_meaning:.*email/i);
assert.match(formatted, /guidance:/);

const rateLimit = toolFeedbackFromError(new Error("429 rate limit"), { tool: "schedule_appointment" });
assert.equal(rateLimit.recovery_class, "RATE_LIMITED");
assert.equal(rateLimit.runtime_handled_retry, true);

const slot = toolFeedbackFromError(new Error("Slot no longer available"), {
  tool: "schedule_appointment",
});
assert.equal(slot.recovery_class, "RESOURCE_UNAVAILABLE");
assert.equal(slot.next_action, "list_slots_then_retry");

const success = toolFeedbackSuccess("Done.", { tool: "take_message" });
assert.equal(success.outcome, "success");
assert.match(formatToolFeedbackForModel(success), /TOOL_FEEDBACK: success/);

const recoverable = toolFeedbackRecoverable({
  tool: "transfer_to_human",
  recovery_class: "TRANSFER_BUSY",
  reason: "busy",
  next_action: "take_message",
  guidance: "Offer to take a message.",
});
assert.equal(recoverable.outcome, "recoverable_failure");

const legacyOk = toLegacyVoiceShape(
  toolSuccess({
    status: "confirmed",
    data: { tool: "book_appointment" },
    user_message: "Booked.",
  }),
);
assert.ok(typeof legacyOk.tool_feedback === "string");
assert.match(String(legacyOk.tool_feedback), /TOOL_FEEDBACK: success/);

const legacyFail = toLegacyVoiceShape(
  failResult(new AgentToolError("MISSING_REQUIRED_FIELD", "need email", false, "Need email"), "op1"),
);
assert.match(String(legacyFail.tool_feedback), /recoverable_failure|MISSING_INFORMATION/);

console.log("tool feedback tests: PASS");
