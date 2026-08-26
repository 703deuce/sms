/**
 * Transovo platform feature entitlements + catalog contracts.
 * Run: npx tsx scripts/test-transovo-platform.ts
 */
import assert from "node:assert/strict";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import { workspaceHasAdminFullEntitlements } from "../src/lib/products/feature-entitlements";
import { buildSmartRoutingNavChildren } from "../src/lib/smart-routing/nav-children";
import {
  defaultFeaturesForWorkspaceType,
  activeTransovoFeatures,
} from "../src/lib/products/feature-entitlements";
import { grantsForPlatformProduct, listPlatformPurchasableProducts } from "../src/lib/products/platform-billing-catalog";
import { renderMctbMessageTemplate, resolveMctbMessageTemplate } from "../src/lib/mctb/message-template";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";

const businessDefaults = defaultFeaturesForWorkspaceType("BUSINESS");
assert.ok(businessDefaults.some((d) => d.feature === "mctb" && d.status === "inactive"));
assert.ok(businessDefaults.some((d) => d.feature === "smart_routing" && d.status === "inactive"));

const srNav = buildSmartRoutingNavChildren();
assert.ok(srNav.some((i) => i.label === "Business Call Back"));
assert.ok(srNav.some((i) => i.label === "AI Routing Assistant"));
assert.ok(srNav.some((i) => i.href === "/smart-routing/analytics"));
assert.ok(!srNav.some((i) => i.label === "Routing Analytics"));

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
assert.ok(labels.includes("Conversations"));
assert.ok(nav.some((i) => i.href === "/smart-routing" && i.label === "Overview"));
assert.ok(nav.some((i) => i.sectionLabel === "Smart Routing"));
assert.equal(nav.find((i) => i.label === "Conversations")?.href, "/inbox");
assert.ok(labels.includes("Visual Voicemail"));
assert.ok(labels.includes("Buy Numbers"));
assert.ok(nav.some((i) => i.href === "/voice/analytics" && i.label === "Analytics"));
assert.ok(!nav.some((i) => i.href === "/voice/analytics" && i.sectionLabel === "Manage"));
assert.equal(nav.find((i) => i.label === "Callback Requests")?.href, "/voice/callback-requests");
assert.ok(labels.includes("Business Call Back"));

const srOnly = buildVoiceNav({
  productFeatures: {
    mctb: "inactive",
    smart_routing: "active",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  },
});
assert.ok(!srOnly.some((i) => i.label === "Missed Calls"));
assert.ok(srOnly.some((i) => i.href === "/smart-routing" && i.label === "Overview"));
assert.ok(srOnly.some((i) => i.label === "Analytics" && i.href === "/smart-routing/analytics"));

const massTextUnified = buildVoiceNav({
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
const mtLabels = massTextUnified.map((i) => i.label);
assert.ok(mtLabels.includes("Overview"), "Mass Texting overview on MCTB menu");
assert.ok(mtLabels.includes("Campaigns"), "Mass Texting campaigns on MCTB menu");
assert.ok(mtLabels.includes("Missed Calls"), "MCTB items remain on unified menu");
assert.ok(massTextUnified.some((i) => i.sectionLabel === "Mass Texting"));

assert.ok(listPlatformPurchasableProducts().length >= 8);

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

import { SMART_ROUTING_NODE_TYPES } from "../src/lib/smart-routing/types";
assert.ok(SMART_ROUTING_NODE_TYPES.includes("CALLBACK"));

import { showSrBusinessCallBack } from "../src/lib/products/transovo-launch";
assert.equal(showSrBusinessCallBack(), true);

(async () => {
  assert.equal(await workspaceHasAdminFullEntitlements("ws-test", { isPlatformAdmin: true }), true);
  console.log("test-transovo-platform: ok");
})();
