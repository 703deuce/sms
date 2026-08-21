/**
 * MCTB production verification phases — architecture is code-complete;
 * these phases require live Twilio, carriers, Stripe, and browser QA.
 *
 * Run unit checks: npx tsx scripts/test-mctb-production-phases.ts
 */
import assert from "node:assert/strict";
import { mergeTfvStatuses } from "../src/lib/mctb/tfv/state-update";
import { mapTwilioTfvStatus } from "../src/lib/messaging/compliance/messaging-compliance";
import { buildTfvSubmissionPayload } from "../src/lib/mctb/tfv/payload";

// Phase A — provider mapping sanity (live Twilio still required separately)
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
  reg: { useCaseDescription: "", optInFormUrl: "https://acme.example/opt-in", messageVolume: "100" } as never,
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

const PHASES = [
  "A — Provider proof: real TFN provision + TFV submit/status (Twilio console + API)",
  "B — Telephony proof: demo call + conditional forwarding + caller-ID preservation per carrier",
  "C — Messaging proof: outbound SMS + delivery callbacks + inbound replies + STOP + idempotency",
  "D — Trial proof: activation gates + expiration suspension (not enabled:false) + hold + paid conversion",
  "E — UI proof: all MCTB pages backed by real state, mobile-friendly onboarding",
  "F — Production smoke: fresh workspace signup → paid E2E without DB hacks",
] as const;

console.log("MCTB production verification phases:");
for (const phase of PHASES) console.log(`  • ${phase}`);
console.log("\nUnit pre-checks passed. Live provider/carrier/Stripe tests still required.");
