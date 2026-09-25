#!/usr/bin/env tsx
/**
 * MCTB Pass 1C — platform sender controlled AI + takeover race guards.
 * Run: npx tsx scripts/test-mctb-pass-1c-platform-ai.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectPlatformResponseForLeadRecovery } from "../src/lib/mctb/platform-sender/map-lead-recovery-platform-response";
import {
  renderPlatformResponseTemplate,
} from "../src/lib/mctb/platform-sender/platform-response-registry";
import {
  isStaleAutonomousAiOutbound,
  resolveAutomationHandoffWatermarkMs,
} from "../src/lib/mctb/messaging/automation-handoff-watermark";

const modelAuthored = "This is totally custom AI prose the model invented.";
const platform = selectPlatformResponseForLeadRecovery({
  runtimeAction: "approved_info",
  bookingEntitled: false,
  bookingUrl: null,
  businessName: "Acme Plumbing",
});
const platformBody = renderPlatformResponseTemplate(platform.responseId, platform.variables);
assert.notEqual(platformBody, modelAuthored);
assert.match(platformBody, /Acme Plumbing|follow up/i);

const booking = selectPlatformResponseForLeadRecovery({
  runtimeAction: "booking_link_sent",
  bookingEntitled: true,
  bookingUrl: "https://book.example/a",
  businessName: "Acme",
});
assert.equal(booking.responseId, "SEND_BOOKING_LINK");
assert.equal(
  renderPlatformResponseTemplate(booking.responseId, booking.variables),
  "You can book here: https://book.example/a",
);

const freeBooking = selectPlatformResponseForLeadRecovery({
  runtimeAction: "booking_link_sent",
  bookingEntitled: false,
  bookingUrl: "https://book.example/a",
  businessName: "Acme",
});
assert.equal(freeBooking.responseId, "HANDOFF_OWNER_FOLLOWUP");

assert.throws(() => renderPlatformResponseTemplate("SEND_BOOKING_LINK", { businessName: "x" }));

const collect = selectPlatformResponseForLeadRecovery({
  runtimeAction: "collect_NAME",
  bookingEntitled: false,
  bookingUrl: null,
  businessName: "Acme",
});
assert.equal(collect.responseId, "ASK_NAME");

const watermark = resolveAutomationHandoffWatermarkMs({
  humanTakenOverAt: null,
  metadataJson: { lastHumanTakeoverAtMs: 1_000 },
});
assert.equal(watermark, 1_000);
assert.equal(
  isStaleAutonomousAiOutbound({
    enqueuedAtIso: new Date(500).toISOString(),
    handoffWatermarkMs: 1_000,
  }),
  true,
);
assert.equal(
  isStaleAutonomousAiOutbound({
    enqueuedAtIso: new Date(2_000).toISOString(),
    handoffWatermarkMs: 1_000,
  }),
  false,
);

const customerSms = readFileSync("src/lib/agents/missed-call-text-back/customer-sms.ts", "utf8");
assert.match(customerSms, /resolveMctbAiOutboundSmsBody/);
assert.doesNotMatch(
  customerSms.slice(customerSms.indexOf("resolveMctbAiOutboundSmsBody")),
  /body: leadRecovery\.reply/,
);

const sendJob = readFileSync("src/lib/mctb/messaging/send-customer-sms-job.ts", "utf8");
assert.match(sendJob, /validateMctbAutonomousAiOutboundBeforeSend/);
assert.match(sendJob, /OUTBOUND_SUPPRESSED/);

const automation = readFileSync("src/lib/mctb/handoff/automation-state.ts", "utf8");
assert.match(automation, /mergeLastHumanTakeoverMetadata/);

console.log("test-mctb-pass-1c-platform-ai: OK");
