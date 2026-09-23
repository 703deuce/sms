#!/usr/bin/env tsx
/**
 * MCTB simplified launch invariants (Pass 1 + Pass 2).
 * npx tsx scripts/test-mctb-simplified-launch.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY,
  MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI,
  MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI,
  MCTB_LAUNCH_TRY_IT_ENABLED,
} from "../src/lib/mctb/launch-flags";
import { getRecoveryGoalDefinition, MCTB_RECOVERY_GOALS } from "../src/lib/mctb/recovery-goals";
import {
  defaultNewMctbNotificationRecipientEventChannels,
  recipientAllowsNotificationChannel,
} from "../src/lib/mctb/handoff/recipient-event-routing";
import { isCarrierProtocolOptOutMessage } from "../src/lib/mctb/lead-recovery/protocol-intent";
import { shouldShowTryItNav } from "../src/lib/mctb/try-it/visibility";
import { launchBookingIntentActions } from "../src/lib/mctb/launch-lead-recovery";
import { defaultLaunchEnabledScenarios } from "../src/lib/mctb/lead-recovery/scenarios";
import { launchFaqIntentPolicyOverrides } from "../src/lib/mctb/lead-recovery/launch-faq-policies";
import { MCTB_SETUP_FIELD_AUTHORITY } from "../src/lib/mctb/setup-field-authority";

assert.equal(MCTB_LAUNCH_TRY_IT_ENABLED, false);
assert.equal(shouldShowTryItNav("trial"), false);
assert.equal(shouldShowTryItNav("trial", { isPlatformAdmin: true }), true);

assert.equal(MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY, true);
assert.equal(MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI, true);
assert.equal(MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI, true);

const vaPage = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/voice-agent/mctb-voice-agent-page.tsx"),
  "utf8",
);
assert.ok(!vaPage.includes("CallHandlingDashboardCard"));
assert.ok(!vaPage.includes("CallHandlingModeSwitch"));
assert.ok(!vaPage.includes("/api/mctb/inbound-handling"));

const inboundSwitch = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/inbound-handling/switch-mode.ts"),
  "utf8",
);
assert.ok(inboundSwitch.includes("setActiveCallHandler"));
assert.ok(!inboundSwitch.includes("routePhoneToTexmlAssistant"));
assert.ok(!inboundSwitch.includes("routePhoneToTexmlApp"));

const lrPage = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/lead-recovery/ai-lead-recovery-page.tsx"),
  "utf8",
);
assert.ok(lrPage.includes("MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI"));
assert.ok(!lrPage.includes('<PolicyCard title="Payments"'));

const missedList = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/missed-calls-view.tsx"),
  "utf8",
);
assert.ok(!missedList.includes("Consent mode"));

const recipientBase = {
  id: "r1",
  name: "A",
  email: "a@example.com",
  mobileE164: "+15551234567",
  roleDescription: null,
  enabled: true,
  sortOrder: 0,
};

const explicitNewDefaults = defaultNewMctbNotificationRecipientEventChannels();
assert.ok(Object.keys(explicitNewDefaults).length >= 6);
assert.equal(explicitNewDefaults.caller_replied?.email, true);
assert.equal(explicitNewDefaults.lead_captured?.email, true);

assert.equal(
  recipientAllowsNotificationChannel({
    recipient: { ...recipientBase, eventChannels: {} },
    eventType: "caller_replied",
    channel: "email",
  }),
  true,
);

assert.equal(
  recipientAllowsNotificationChannel({
    recipient: { ...recipientBase, eventChannels: explicitNewDefaults },
    eventType: "caller_replied",
    channel: "email",
  }),
  true,
);

assert.ok(isCarrierProtocolOptOutMessage("STOP"));

assert.equal(
  recipientAllowsNotificationChannel({
    recipient: {
      ...recipientBase,
      eventChannels: { caller_replied: { email: false } },
    },
    eventType: "caller_replied",
    channel: "email",
  }),
  false,
);

assert.equal(
  recipientAllowsNotificationChannel({
    recipient: {
      ...recipientBase,
      eventChannels: { caller_replied: { sms: true, email: true } },
    },
    eventType: "caller_replied",
    channel: "sms",
  }),
  false,
);

const bookingActions = launchBookingIntentActions();
assert.ok(bookingActions.includes("SEND_BOOKING_LINK"));
assert.ok(!bookingActions.includes("AI_BOOK"));

assert.equal(defaultLaunchEnabledScenarios().general_faq, true);
assert.deepEqual(launchFaqIntentPolicyOverrides().BUSINESS_HOURS?.actions, [
  "ANSWER_APPROVED_INFORMATION",
]);

const launchLr = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/launch-lead-recovery.ts"),
  "utf8",
);
assert.ok(launchLr.includes("ANSWER_APPROVED_INFORMATION"));
assert.ok(launchLr.includes("defaultLaunchEnabledScenarios"));

assert.equal(MCTB_RECOVERY_GOALS.length, 4);
assert.ok(getRecoveryGoalDefinition("book_appointment").defaultOpener.includes("{{link}}"));

assert.ok(MCTB_SETUP_FIELD_AUTHORITY.recoveryGoal.fields.includes("recoveryGoal"));

const switcher = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/set-active-call-handler.ts"),
  "utf8",
);
assert.ok(switcher.includes("resolveCanonicalVoiceIngressPhoneNumberId"));
assert.ok(!switcher.includes("mctbInbound"));

const onboarding = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/onboarding-wizard.tsx"),
  "utf8",
);
assert.ok(onboarding.includes("MctbRecoveryGoalSetupSection"));
assert.ok(onboarding.includes("OnboardingVoicemailStep"));

const textBack = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/setup/setup-text-back-view.tsx"),
  "utf8",
);
assert.ok(textBack.includes("MctbRecoveryGoalSetupSection"));
assert.ok(!textBack.includes("MctbTextBackComposer"));

const setupTest = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/setup/setup-test-view.tsx"),
  "utf8",
);
assert.ok(!setupTest.includes("/api/mctb/try-it"));
assert.ok(setupTest.includes("/api/mctb/setup-test"));
assert.ok(setupTest.includes("/api/mctb/live-test"));

const legacyPanel = fs.readFileSync(
  path.join(process.cwd(), "src/components/numbers/call-handling-mode-panel.tsx"),
  "utf8",
);
assert.ok(legacyPanel.includes("MCTB Overview"));
assert.ok(!legacyPanel.includes("call-handling-mode"));

const notifications = fs.readFileSync(
  path.join(process.cwd(), "src/components/mctb/setup/setup-notifications-view.tsx"),
  "utf8",
);
assert.ok(notifications.includes("set_launch_ai_replies"));
assert.ok(notifications.includes("Email events for this recipient"));
assert.ok(notifications.includes("defaultNewMctbNotificationRecipientEventChannels"));

const customerSms = fs.readFileSync(
  path.join(process.cwd(), "src/lib/agents/missed-call-text-back/customer-sms.ts"),
  "utf8",
);
assert.ok(customerSms.includes("recordMctbInboundSmsOptOut"));
const stopIdx = customerSms.indexOf("isCarrierProtocolOptOutMessage");
const lrDisabledIdx = customerSms.indexOf("lead_recovery_not_enabled");
assert.ok(stopIdx > 0 && lrDisabledIdx > 0 && stopIdx < lrDisabledIdx);

console.log("test-mctb-simplified-launch: PASS");
