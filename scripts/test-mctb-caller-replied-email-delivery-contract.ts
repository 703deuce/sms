#!/usr/bin/env tsx
/**
 * Static contract: caller_replied production path must reach email delivery hooks.
 * Complements runtime proof (prod matrix toggle + recipient) — does not send mail.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY } from "../src/lib/mctb/launch-flags";

const notifications = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/handoff/notifications.ts"),
  "utf8",
);
const sideEffects = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/handoff/inbound-reply-handoff.ts"),
  "utf8",
);

assert.ok(
  sideEffects.includes("deliverMctbHandoffNotifications"),
  "inbound side effects must call deliverMctbHandoffNotifications",
);
assert.ok(
  notifications.includes("notifyWorkspaceByEmail"),
  "handoff notifications must use workspace email delivery",
);
assert.ok(
  notifications.includes("mctbNotificationDelivery"),
  "handoff notifications must persist delivery idempotency rows",
);
assert.ok(
  notifications.includes("config.routingMatrix[input.eventType]"),
  "routing must use matrix row for resolved event type",
);
assert.ok(
  notifications.includes("channels.email"),
  "email channel must be evaluated from routing matrix",
);

assert.equal(
  MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY,
  true,
  "launch default: document expects email-only team notifications flag on",
);
assert.ok(
  notifications.includes("MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY"),
  "notifications must respect launch email-only flag for in_app",
);

console.log("test-mctb-caller-replied-email-delivery-contract: ok");
