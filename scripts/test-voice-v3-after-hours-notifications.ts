#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { compileAfterHoursNotificationsFromWizard } from "../src/lib/voice-v3/notifications/compile-from-wizard";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { formatCallbackSms } from "../src/lib/voice-v3/notifications/format-callback-notification";
import { REQUEST_CALLBACK_TOOL_DESCRIPTION } from "../src/lib/voice-v3/tools/astra-tool-contracts";

const wizard = createDefaultWizardState();
wizard.callbackRequiredCollectFieldIds = ["full_name", "phone"];
wizard.afterHoursNotificationRecipients = [
  {
    id: "r1",
    label: "On-call",
    smsE164: "+15555550100",
    email: "oncall@example.com",
    smsEnabled: true,
    emailEnabled: true,
    enabled: true,
  },
];

const compiled = compileAfterHoursNotificationsFromWizard(wizard);
assert.equal(compiled.recipients.length, 1);
assert.equal(compiled.events["callback.requested"].sms, true);

const agent = compileVoiceV3AgentConfig({ wizard, source: "wizard_published" });
assert.ok(agent.afterHoursNotifications?.recipients?.length === 1);
assert.ok(agent.callHandling.callbackRequiredCollectFieldIds?.includes("full_name"));

const sms = formatCallbackSms({
  callerPhone: "+15715551212",
  callerName: "John",
  reason: "Water heater",
  receivedAt: new Date("2026-09-20T23:42:00Z"),
});
assert.match(sms, /callback request/i);
assert.match(sms, /Water heater/);

assert.match(REQUEST_CALLBACK_TOOL_DESCRIPTION, /leave a message/i);

console.log("VOICE_V3_AFTER_HOURS_NOTIFICATIONS_TESTS_PASS");
