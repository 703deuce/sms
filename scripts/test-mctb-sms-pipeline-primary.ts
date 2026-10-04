#!/usr/bin/env tsx
/**
 * SMS pipeline primary path — config defaults, customer-sms wiring, calendar path preserved.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calendarFulfillmentEnabled,
  resolveSmsBookingFulfillmentMode,
} from "../src/lib/mctb/ai-booking/fulfillment-mode";
import type { MctbAiBookingWorkspaceConfig } from "../src/lib/mctb/ai-booking/config";

const base: MctbAiBookingWorkspaceConfig = {
  enabled: true,
  entitled: true,
  upgradeRequired: false,
  fulfillmentMode: "link_only",
  smsPipelinePrimary: true,
  provider: "microsoft",
  providerConnectionId: null,
  eventTypeId: null,
  eventTypeUri: null,
  calendarId: null,
  serviceName: "Consultation",
  durationMinutes: 30,
  fallbackBookingLinkId: null,
  timezone: "America/New_York",
};

assert.equal(resolveSmsBookingFulfillmentMode(base), "link_only");
assert.equal(calendarFulfillmentEnabled(base), false);
assert.equal(
  calendarFulfillmentEnabled({ ...base, fulfillmentMode: "calendar" }),
  true,
);

const customerSms = readFileSync(
  "src/lib/agents/missed-call-text-back/customer-sms.ts",
  "utf8",
);
assert.ok(customerSms.includes("handleMctbSimpleSmsAgentInbound"));
assert.ok(!customerSms.includes("handleMctbSmsConversationPipeline"));

const runtime = readFileSync("src/lib/mctb/ai-booking/conversation-runtime.ts", "utf8");
assert.ok(runtime.includes("calendarFulfillmentEnabled"));
assert.ok(runtime.includes("orchestrateMctbAiBooking"));

console.log("test-mctb-sms-pipeline-primary: OK");
