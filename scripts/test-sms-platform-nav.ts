/**
 * SMS platform navigation structure — V1 consolidated nav.
 * Run: npx tsx scripts/test-sms-platform-nav.ts
 */
import assert from "node:assert/strict";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import { leadCaptureTabs } from "../src/lib/lead-capture-tabs";

const smsNav = buildSmsPlatformNav({ conversationsBadge: 2 });
const smsLabels = smsNav.map((i) => i.label);
const smsHrefs = smsNav.map((i) => i.href);

assert.ok(smsNav.find((i) => i.label === "Conversations")?.href === "/conversations");
assert.ok(!smsLabels.includes("Inbox"));
assert.ok(!smsLabels.includes("Media library"));
assert.ok(!smsLabels.includes("Reports"));
assert.ok(smsLabels.includes("Analytics"));
assert.equal(smsNav.find((i) => i.label === "Analytics")?.href, "/analytics");
assert.ok(!smsHrefs.includes("/grow/contests"));
assert.ok(!smsHrefs.includes("/grow/sources"));
assert.ok(!smsHrefs.includes("/messaging/media"));
for (const tab of leadCaptureTabs) {
  assert.ok(smsHrefs.includes(tab.href), `Lead capture tab missing: ${tab.href}`);
}
assert.ok(smsLabels.includes("Manage Numbers"));
assert.ok(smsLabels.includes("Buy Numbers"));
assert.ok(smsLabels.includes("Workspace"));

const unified = buildVoiceNav({
  hasSms: true,
  productFeatures: {
    mctb: "active",
    mass_texting: "active",
    smart_routing: "inactive",
    call_forwarding: "inactive",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
    ai_transcription: "inactive",
  },
});
const labels = unified.map((i) => i.label);
assert.equal(labels.filter((l) => l === "Conversations").length, 1);
assert.ok(labels.includes("Missed Calls"));
assert.ok(labels.includes("Visual Voicemail"));
assert.ok(labels.includes("Business Profile"));
assert.ok(!labels.includes("Inbox"));

console.log("test-sms-platform-nav: ok");
