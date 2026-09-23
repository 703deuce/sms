#!/usr/bin/env tsx
/**
 * MCTB simplified launch invariants (deterministic).
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

assert.equal(MCTB_LAUNCH_TRY_IT_ENABLED, false);
assert.equal(shouldShowTryItNav("trial"), false);
assert.equal(shouldShowTryItNav("trial", { isPlatformAdmin: true }), true);

assert.equal(MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY, true);
assert.equal(
  recipientAllowsNotificationChannel({
    recipient: {
      id: "r1",
      name: "A",
      email: "a@example.com",
      mobileE164: "+15551234567",
      roleDescription: null,
      eventChannels: {},
      enabled: true,
      sortOrder: 0,
    },
    eventType: "caller_replied",
    channel: "email",
  }),
  true,
);
assert.equal(
  recipientAllowsNotificationChannel({
    recipient: {
      id: "r1",
      name: "A",
      email: "a@example.com",
      mobileE164: "+15551234567",
      roleDescription: null,
      eventChannels: { caller_replied: { sms: true } },
      enabled: true,
      sortOrder: 0,
    },
    eventType: "caller_replied",
    channel: "sms",
  }),
  false,
);

assert.equal(MCTB_RECOVERY_GOALS.length, 4);
assert.ok(getRecoveryGoalDefinition("book_appointment").defaultOpener.includes("{{link}}"));

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
assert.ok(onboarding.includes("MctbRecoveryGoalCards"));
assert.ok(onboarding.includes("OnboardingVoicemailStep"));

console.log("test-mctb-simplified-launch: PASS");
