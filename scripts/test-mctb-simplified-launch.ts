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
  MCTB_LAUNCH_TRY_IT_ENABLED,
} from "../src/lib/mctb/launch-flags";
import { getRecoveryGoalDefinition, MCTB_RECOVERY_GOALS } from "../src/lib/mctb/recovery-goals";
import { recipientAllowsNotificationChannel } from "../src/lib/mctb/handoff/recipient-event-routing";
import { shouldShowTryItNav } from "../src/lib/mctb/try-it/visibility";
import { launchBookingIntentActions } from "../src/lib/mctb/launch-lead-recovery";
import { MCTB_SETUP_FIELD_AUTHORITY } from "../src/lib/mctb/setup-field-authority";

assert.equal(MCTB_LAUNCH_TRY_IT_ENABLED, false);
assert.equal(shouldShowTryItNav("trial"), false);
assert.equal(shouldShowTryItNav("trial", { isPlatformAdmin: true }), true);

assert.equal(MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY, true);

const recipientBase = {
  id: "r1",
  name: "A",
  email: "a@example.com",
  mobileE164: "+15551234567",
  roleDescription: null,
  enabled: true,
  sortOrder: 0,
};

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

console.log("test-mctb-simplified-launch: PASS");
