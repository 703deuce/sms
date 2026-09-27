#!/usr/bin/env tsx
/**
 * Guard: qualified MCTB inbound replies must reach handoff notifications even when AI Lead Recovery is off.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const customerSms = readFileSync(
  path.join(process.cwd(), "src/lib/agents/missed-call-text-back/customer-sms.ts"),
  "utf8",
);
const sideEffects = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/handoff/lead-recovery-inbound-side-effects.ts"),
  "utf8",
);

assert.ok(
  !customerSms.includes('reason: "lead_recovery_not_enabled"'),
  "customer-sms must not abort inbound before handoff when Lead Recovery is disabled",
);
assert.ok(
  customerSms.includes("mctb_notifications_only"),
  "customer-sms must have notifications-only path when Lead Recovery is off",
);
assert.ok(
  customerSms.includes("recordMctbLeadRecoveryInboundSideEffects"),
  "customer-sms must call inbound handoff side effects",
);
assert.ok(
  sideEffects.includes("caller_replied:${idemSuffix}"),
  "handoff caller_replied idempotency must include provider message id",
);
assert.ok(
  sideEffects.includes("assessMctbUrgency({ customerText: input.body, config })"),
  "handoff side effects must assess urgency from reply text when no structured intent",
);

console.log("test-mctb-caller-replied-inbound-path: ok");
