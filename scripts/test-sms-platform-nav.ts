/**
 * SMS platform navigation structure.
 * Run: npx tsx scripts/test-sms-platform-nav.ts
 */
import assert from "node:assert/strict";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import { growTabs } from "../src/lib/grow-tabs";

const growNavHrefs = growTabs
  .filter(
    (tab) =>
      tab.href !== "/grow/click-to-text" &&
      tab.href !== "/grow/pages" &&
      tab.href !== "/grow/contact-cards",
  )
  .map((tab) => tab.href);

const smsNav = buildSmsPlatformNav({ hasMassTexting: true, inboxBadge: 2 });
const smsLabels = smsNav.map((i) => i.label);
const smsHrefs = smsNav.map((i) => i.href);

assert.ok(smsNav[0]?.sectionLabel === "SMS");
assert.ok(!smsLabels.includes("Overview"));
assert.ok(smsLabels.includes("Inbox"));
assert.ok(smsLabels.includes("Campaigns"));
assert.equal(smsNav.find((i) => i.label === "Send")?.href, "/send");
assert.ok(!smsHrefs.includes("/send/quick"));
assert.ok(smsHrefs.includes("/send/ai"));
assert.ok(smsLabels.includes("Message templates"));
assert.ok(smsHrefs.includes("/reports/links"));
assert.ok(!smsHrefs.includes("/messaging/payments"));
assert.ok(!smsLabels.includes("Lists"));
assert.ok(!smsLabels.includes("Quick text"));
assert.ok(!smsLabels.includes("Text-to-pay"));
assert.ok(!smsLabels.includes("Surveys"));
assert.ok(!smsLabels.includes("Help"));
assert.ok(smsLabels.includes("Flows"));
assert.ok(smsHrefs.includes("/automations/templates"));
assert.ok(smsHrefs.includes("/automations/new"));
assert.ok(smsHrefs.includes("/automations/logs"));
for (const href of growNavHrefs) {
  assert.ok(smsHrefs.includes(href), `Lead capture tab missing: ${href}`);
}
assert.ok(!smsHrefs.includes("/grow/click-to-text"));
assert.ok(!smsHrefs.includes("/grow/pages"));
assert.ok(!smsHrefs.includes("/grow/contact-cards"));
assert.equal(smsNav.find((i) => i.label === "Reports")?.href, "/reports");
assert.ok(!smsHrefs.includes("/reports/campaigns"));
assert.equal(smsNav.find((i) => i.label === "Compliance")?.href, "/compliance");
assert.ok(smsLabels.includes("Integrations"));
assert.ok(smsLabels.includes("Billing"));
assert.ok(smsNav.some((i) => i.sectionLabel === "Lead capture"));

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
const inboxCount = labels.filter((l) => l === "Inbox").length;
assert.equal(inboxCount, 1, "Unified inbox appears once when SMS + MCTB are active");
assert.equal(unified.find((i) => i.label === "Inbox")?.href, "/inbox");
assert.ok(labels.includes("Visual Voicemail"));
assert.ok(!labels.includes("Conversations"));
assert.ok(!labels.includes("Transcription"));
assert.ok(!labels.includes("Callback Requests"));

console.log("test-sms-platform-nav: ok");
