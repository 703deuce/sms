#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  finalizeMctbAgentSmsReply,
  stripMctbTrackingUrlsFromSms,
  stripUnverifiedCallerNameFromAgentReply,
  stripUrlsFromMctbAgentSmsReply,
} from "../src/lib/mctb/sms-channel";

const tracking =
  "We help with missed calls. Someone will follow up shortly, Anthony. https://transovo.ai/r/cb4a88738c6a14a69ec10606fb0618a8";
const stripped = stripUrlsFromMctbAgentSmsReply(tracking);
assert.ok(!stripped.includes("/r/"));
assert.ok(!stripped.includes("https://"));
assert.match(stripped, /follow up shortly/);

const withBooking = finalizeMctbAgentSmsReply(
  "Pick a time here https://example.com/book and also https://transovo.ai/r/abc",
  { allowedUrl: "https://example.com/book" },
);
assert.ok(withBooking.includes("https://example.com/book"));
assert.ok(!withBooking.includes("/r/"));

const long =
  "A".repeat(400) +
  ". Short ending.";
const capped = finalizeMctbAgentSmsReply(long);
assert.ok(capped.length < 400);
assert.ok(capped.endsWith("...") || capped.length <= 313);

assert.equal(
  stripMctbTrackingUrlsFromSms("Hi https://transovo.ai/r/abc123 thanks"),
  "Hi thanks",
);

const thread = [
  { role: "business", text: "Our team will follow up shortly, Anthony." },
  { role: "customer", text: "Do I have to go through A2P" },
] as const;
const noAnthony = stripUnverifiedCallerNameFromAgentReply(
  "I don't have those details. Our team will follow up with you shortly, Anthony.",
  [...thread],
  ["Anthony"],
);
assert.ok(!noAnthony.includes("Anthony"));

console.log("test-mctb-agent-sms-sanitize: OK");
