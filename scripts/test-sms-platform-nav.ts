/**
 * SMS platform navigation structure.
 * Run: npx tsx scripts/test-sms-platform-nav.ts
 */
import assert from "node:assert/strict";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import { growTabs } from "../src/lib/grow-tabs";

const smsNav = buildSmsPlatformNav({ hasMassTexting: true, inboxBadge: 2 });
const smsLabels = smsNav.map((i) => i.label);
const smsHrefs = smsNav.map((i) => i.href);

assert.ok(smsNav[0]?.sectionLabel === "SMS");
assert.ok(smsLabels.includes("Overview"));
assert.ok(smsLabels.includes("Inbox"));
assert.ok(smsLabels.includes("Campaigns"));
assert.equal(smsNav.find((i) => i.label === "Send")?.href, "/send");
assert.ok(smsHrefs.includes("/send/quick"));
assert.ok(smsHrefs.includes("/send/ai"));
assert.ok(smsLabels.includes("Message templates"));
assert.ok(smsHrefs.includes("/reports/links"));
assert.ok(smsHrefs.includes("/messaging/payments"));
assert.ok(smsLabels.includes("Flows"));
assert.ok(smsHrefs.includes("/automations/templates"));
assert.ok(smsHrefs.includes("/automations/new"));
assert.ok(smsHrefs.includes("/automations/logs"));
for (const tab of growTabs) {
  assert.ok(smsHrefs.includes(tab.href), `Grow tab missing: ${tab.href}`);
}
assert.ok(smsHrefs.includes("/reports/campaigns"));
assert.ok(smsHrefs.includes("/reports/integrations"));
assert.ok(smsLabels.includes("Integrations"));
assert.ok(smsLabels.includes("Billing"));

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
