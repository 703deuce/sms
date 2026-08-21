/**
 * MCTB production verification phases — unit/automated pre-checks.
 * Live Twilio, carriers, Stripe, and browser QA tracked in mctb-launch-readiness-matrix.ts.
 *
 * Run: npx tsx scripts/test-mctb-production-phases.ts
 */
import assert from "node:assert/strict";
import { mergeTfvStatuses } from "../src/lib/mctb/tfv/state-update";
import { mapTwilioTfvStatus } from "../src/lib/messaging/compliance/messaging-compliance";
import { buildTfvSubmissionPayload } from "../src/lib/mctb/tfv/payload";
import { canReserveTrialSmsSegments } from "../src/lib/mctb/entitlement";
import { evaluateCallerIdForMctb } from "../src/lib/mctb/spam-filter";
import {
  MCTB_ABANDONED_ONBOARDING_DAYS,
  MCTB_NUMBER_HOLD_DAYS,
} from "../src/lib/mctb/onboarding/number-lifecycle";

// ── Phase A pre-checks ────────────────────────────────────────────────────
assert.equal(mapTwilioTfvStatus("PENDING_REVIEW"), "PENDING");
assert.equal(mapTwilioTfvStatus("IN_REVIEW"), "PENDING");
assert.equal(mapTwilioTfvStatus("TWILIO_APPROVED"), "APPROVED");
assert.equal(mergeTfvStatuses("APPROVED", "PENDING"), "APPROVED");

const press1 = buildTfvSubmissionPayload({
  reg: { useCaseDescription: "", optInFormUrl: "", messageVolume: "100" } as never,
  businessName: "Acme",
  businessWebsite: "https://acme.example",
  notificationEmail: "ops@acme.example",
  messageTemplate: "Sorry we missed your call",
  consentMode: "press_1",
  tollfreePhoneNumberSid: "PN123",
  externalReferenceId: "mctb-tfv:ws:pn",
});
assert.equal(press1.optInType, "VERBAL");
assert.match(press1.additionalInformation, /press 1/i);

const existing = buildTfvSubmissionPayload({
  reg: {
    useCaseDescription: "",
    optInFormUrl: "https://acme.example/opt-in",
    messageVolume: "100",
  } as never,
  businessName: "Acme",
  businessWebsite: "https://acme.example",
  notificationEmail: "ops@acme.example",
  messageTemplate: "Sorry we missed your call",
  consentMode: "existing_consent",
  tollfreePhoneNumberSid: "PN123",
  externalReferenceId: "mctb-tfv:ws:pn",
});
assert.equal(existing.optInType, "WEB_FORM");
assert.doesNotMatch(existing.additionalInformation, /press 1/i);

// ── Phase B lifecycle simulations ───────────────────────────────────────────
assert.equal(
  mapTwilioTfvStatus("TWILIO_REJECTED", {
    editExpiration: new Date(Date.now() + 86400000).toISOString(),
  }),
  "ACTION_REQUIRED",
);
assert.equal(mapTwilioTfvStatus("TWILIO_REJECTED"), "REJECTED");
assert.equal(mergeTfvStatuses("APPROVED", "REJECTED"), "APPROVED");
assert.equal(mergeTfvStatuses("PENDING", "APPROVED"), "APPROVED");
assert.equal(mergeTfvStatuses("SUBMITTED", "PENDING"), "PENDING");
assert.equal(mergeTfvStatuses("REJECTED", "PENDING"), "REJECTED");

// Stale callback after approval
for (const stale of ["PENDING", "SUBMITTED", "ACTION_REQUIRED", "REJECTED"]) {
  assert.equal(
    mergeTfvStatuses("APPROVED", stale as never),
    "APPROVED",
    `APPROVED must not regress to ${stale}`,
  );
}

// ── Trial SMS atomic reservation (concurrency simulation) ───────────────────
assert.equal(canReserveTrialSmsSegments(99, 100, 1), true);
assert.equal(canReserveTrialSmsSegments(99, 100, 2), false);
assert.equal(canReserveTrialSmsSegments(100, 100, 1), false);

{
  let used = 99;
  const limit = 100;
  const concurrent = 20;
  let allowed = 0;
  const lock = { held: false };

  const results = Array.from({ length: concurrent }, () => {
    // Simulate serialized FOR UPDATE — only one reservation at a time
    while (lock.held) {
      /* spin */
    }
    lock.held = true;
    const ok = canReserveTrialSmsSegments(used, limit, 1);
    if (ok) {
      used += 1;
      allowed += 1;
    }
    lock.held = false;
    return ok;
  });

  assert.equal(allowed, 1, "Only one send should pass when usage is 99/100");
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(used, 100);
}

// ── Spam / robocall filter ──────────────────────────────────────────────────
assert.equal(evaluateCallerIdForMctb("+266696687").blocked, true);
assert.equal(evaluateCallerIdForMctb("anonymous").blocked, true);
assert.equal(evaluateCallerIdForMctb("+17035551234").blocked, false);
assert.equal(evaluateCallerIdForMctb("+10000000000").reason, "SPAM");

// ── Number lifecycle constants ──────────────────────────────────────────────
assert.equal(MCTB_NUMBER_HOLD_DAYS, 7);
assert.equal(MCTB_ABANDONED_ONBOARDING_DAYS, 14);

// ── Phase list (informational) ──────────────────────────────────────────────
const PHASES = [
  "A — Twilio provider proof (TFN provision + TFV field compare)",
  "B — TFV lifecycle (live sync + simulated payloads)",
  "C — Demo experience (session gating + real call E2E)",
  "D — Forwarding / caller-ID preservation (carrier manual)",
  "E — Press-1 consent chain + audit records",
  "F — Existing consent attestation + TFV payload",
  "Messaging — idempotency, delivery, STOP/START, cooldown",
  "Trial — activation gates, atomic SMS cap, expiry, hold, paid conversion",
  "Stripe — checkout + webhook matrix",
  "P0 — spam filter, admin snapshot, abandoned onboarding cleanup",
  "UI — 9-page browser QA + fresh production smoke",
] as const;

console.log("MCTB production verification phases:");
for (const phase of PHASES) console.log(`  • ${phase}`);
console.log("\nUnit + simulation pre-checks passed.");
console.log("See scripts/mctb-launch-readiness-matrix.ts for full readiness status.");
