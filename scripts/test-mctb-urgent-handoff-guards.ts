/**
 * Guard: classifier failure + channel isolation semantics (no DB).
 */
import assert from "node:assert/strict";
import { planInboundReplyNotificationEvent } from "../src/lib/mctb/handoff/inbound-reply-notification-plan";
import {
  validateMctbNotificationRecipientsForSave,
  MctbNotificationRecipientValidationError,
} from "../src/lib/mctb/handoff/recipient-validation";

assert.equal(
  planInboundReplyNotificationEvent({ callbackRequested: false, urgent: false }).eventType,
  "caller_replied",
);

assert.equal(
  planInboundReplyNotificationEvent({ callbackRequested: false, urgent: true }).eventType,
  "urgent_detected",
);

try {
  validateMctbNotificationRecipientsForSave([
    { name: "A", email: "a@example.com", mobileE164: "+15555550101", enabled: true, sortOrder: 0, eventChannels: {} },
    { name: "B", email: "b@example.com", mobileE164: "+15555550101", enabled: true, sortOrder: 1, eventChannels: {} },
  ]);
  assert.fail("expected duplicate mobile rejection");
} catch (e) {
  assert.ok(e instanceof MctbNotificationRecipientValidationError);
}

try {
  validateMctbNotificationRecipientsForSave([
    { name: "Bad", email: null, mobileE164: "not-a-phone", enabled: true, sortOrder: 0, eventChannels: {} },
  ]);
  assert.fail("expected invalid phone rejection");
} catch (e) {
  assert.ok(e instanceof MctbNotificationRecipientValidationError);
}

console.log("test-mctb-urgent-handoff-guards: PASS");
