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
} from "../src/lib/products/feature-entitlements";
import { listPlatformPurchasableProducts } from "../src/lib/products/platform-billing-catalog";
import { renderMctbMessageTemplate, resolveMctbMessageTemplate } from "../src/lib/mctb/message-template";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";

const businessDefaults = defaultFeaturesForWorkspaceType("BUSINESS");
assert.ok(businessDefaults.some((d) => d.feature === "mctb" && d.status === "inactive"));
assert.ok(businessDefaults.some((d) => d.feature === "smart_routing" && d.status === "inactive"));

const srNav = buildSmartRoutingNavChildren();
assert.ok(srNav.some((i) => i.label === "Business Call Back"));

const nav = buildVoiceNav({
  productFeatures: {
    mctb: "active",
    smart_routing: "active",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  },
  hasSms: true,
});
const labels = nav.map((i) => i.label);
assert.ok(labels.includes("Conversations"));
assert.equal(nav.find((i) => i.label === "Conversations")?.href, "/conversations");
assert.ok(labels.includes("Analytics"));
assert.ok(!labels.includes("Inbox"));
assert.ok(!labels.includes("Contests"));

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
  hasSms: true,
});
const mtLabels = massTextUnified.map((i) => i.label);
assert.ok(mtLabels.includes("Dashboard"));
assert.ok(mtLabels.includes("Keywords"));
assert.ok(mtLabels.includes("Business Profile"));
assert.equal(mtLabels.filter((l) => l === "Conversations").length, 1);

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
