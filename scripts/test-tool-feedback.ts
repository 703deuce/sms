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
} from "../voice-runtime/src/tool-feedback";

const emailFb = toolFeedbackMissingEmail({ tool: "schedule_appointment", slotId: "ST_abc" });
assert.equal(emailFb.outcome, "recoverable_failure");
assert.equal(emailFb.recovery_class, "MISSING_INFORMATION");
assert.equal(emailFb.next_action, "collect_email_then_retry");

const formatted = formatToolFeedbackForModel(emailFb);
assert.match(formatted, /^TOOL_FEEDBACK: recoverable_failure/);
assert.match(formatted, /recovery_class: MISSING_INFORMATION/);
assert.match(formatted, /next_action: collect_email_then_retry/);
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

console.log("tool feedback tests: PASS");
