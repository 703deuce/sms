/**
 * Transovo platform feature entitlements + catalog contracts.
 * Run: npx tsx scripts/test-transovo-platform.ts
 */
import assert from "node:assert/strict";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import {
  defaultFeaturesForWorkspaceType,
  activeTransovoFeatures,
} from "../src/lib/products/feature-entitlements";
import { PLATFORM_BILLING_CATALOG } from "../src/lib/products/platform-billing-catalog";
import { renderMctbMessageTemplate, resolveMctbMessageTemplate } from "../src/lib/mctb/message-template";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";

const businessDefaults = defaultFeaturesForWorkspaceType("BUSINESS");
assert.ok(businessDefaults.some((d) => d.feature === "mctb"));
assert.ok(businessDefaults.some((d) => d.feature === "smart_routing"));

const nav = buildVoiceNav({
  productFeatures: {
    mctb: "active",
    smart_routing: "active",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  },
});
const labels = nav.map((i) => i.label);
assert.ok(labels.includes("Missed Calls"));
assert.ok(labels.includes("Smart Routing"));
assert.ok(labels.includes("Conversations"));
assert.equal(nav.find((i) => i.label === "Conversations")?.href, "/inbox");

const srOnly = buildVoiceNav({
  productFeatures: {
    mctb: "inactive",
    smart_routing: "active",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  },
});
assert.ok(!srOnly.some((i) => i.label === "Missed Calls"));
assert.ok(srOnly.some((i) => i.label === "Smart Routing"));

assert.ok(PLATFORM_BILLING_CATALOG.length >= 5);

const tmpl = resolveMctbMessageTemplate({
  ...DEFAULT_MCTB_CONFIG,
  id: "x",
  workspaceId: "w",
  messageTemplate: "Default",
  messageTemplateBusinessHours: "Business hours msg",
  messageTemplateAfterHours: "After hours msg",
  allowedStartTime: "09:00",
  allowedEndTime: "17:00",
});
assert.ok(typeof tmpl === "string");

const rendered = renderMctbMessageTemplate("Hi {{firstName}}", { firstName: "Sam" });
assert.equal(rendered, "Hi Sam");

console.log("test-transovo-platform: ok");
