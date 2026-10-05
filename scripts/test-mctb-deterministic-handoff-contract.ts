/**
 * Deterministic MCTB handoff + owner SMS + handled-state contracts (no PSTN).
 * npx tsx scripts/test-mctb-deterministic-handoff-contract.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderMctbTeamSms } from "../src/lib/mctb/handoff/templates";
import { MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY } from "../src/lib/mctb/launch-flags";

const customerSms = fs.readFileSync(
  path.join(process.cwd(), "src/lib/agents/missed-call-text-back/customer-sms.ts"),
  "utf8",
);
assert.ok(customerSms.includes('followUpStatus: "needs_follow_up"'));
assert.ok(customerSms.includes("MCTB_LEGACY_AI_SMS_REPLY"));

const handoff = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/handoff/inbound-reply-handoff.ts"),
  "utf8",
);
assert.ok(handoff.includes('followUpStatus: "needs_follow_up"'));

const notifications = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/handoff/notifications.ts"),
  "utf8",
);
assert.ok(notifications.includes("sendMctbBusinessHandoffNotificationSms"));
assert.ok(notifications.includes("canSendMctbBusinessReplyTeamSms"));

const caps = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/capabilities.ts"),
  "utf8",
);
assert.ok(caps.includes("businessReplySms"));

assert.equal(MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY, false);

const sms = renderMctbTeamSms({
  businessName: "Joe's Plumbing",
  eventType: "caller_replied",
  facts: {
    callerPhone: "+15715551234",
    customerMessages: ["Water heater leaking at 123 Main St. Need someone today."],
  },
});
assert.match(sms, /Joe's Plumbing/);
assert.match(sms, /571.*555.*1234|\+15715551234/);
assert.match(sms, /Water heater leaking/);

console.log("test-mctb-deterministic-handoff-contract: PASS");
