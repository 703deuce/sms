/**
 * SMS platform navigation structure.
 * Run: npx tsx scripts/test-sms-platform-nav.ts
 */
import assert from "node:assert/strict";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { buildVoiceNav } from "../src/lib/products/voice-nav";

const smsNav = buildSmsPlatformNav({ hasMassTexting: true, inboxBadge: 2 });
const smsLabels = smsNav.map((i) => i.label);
assert.ok(smsNav[0]?.sectionLabel === "SMS");
assert.ok(smsLabels.includes("Overview"));
assert.ok(smsLabels.includes("Inbox"));
assert.ok(smsLabels.includes("Campaigns"));
assert.ok(smsLabels.includes("Send"));
assert.ok(smsLabels.includes("Contacts"));
assert.ok(smsLabels.includes("Lists"));
assert.ok(smsLabels.includes("Imports"));
assert.ok(smsLabels.includes("Templates"));
assert.ok(smsLabels.includes("Surveys"));
assert.ok(smsLabels.includes("Integrations"));
assert.ok(smsLabels.includes("Billing"));
assert.ok(smsLabels.includes("Media"));
assert.ok(smsLabels.includes("Automations"));
assert.ok(smsLabels.includes("Grow"));
assert.ok(smsLabels.includes("Reports"));
assert.ok(smsLabels.includes("Numbers"));
assert.ok(smsLabels.includes("Compliance"));
assert.ok(smsLabels.includes("Analytics"));
assert.ok(smsLabels.includes("Settings"));
assert.ok(smsLabels.includes("Help"));

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
const inboxIdx = labels.indexOf("Inbox");
const mctbConvIdx = labels.indexOf("Conversations");
assert.ok(inboxIdx >= 0 && mctbConvIdx > inboxIdx, "SMS inbox precedes MCTB conversations");
assert.equal(unified.find((i) => i.label === "Conversations")?.href, "/inbox?product=mctb");

console.log("test-sms-platform-nav: ok");
