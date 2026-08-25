/**
 * Transovo platform feature entitlements + MCTB-only nav contracts.
 * Run: npx tsx scripts/test-transovo-platform.ts
 */
import assert from "node:assert/strict";
import { buildVoiceNav } from "../src/lib/products/voice-nav";
import { workspaceHasAdminFullEntitlements } from "../src/lib/products/feature-entitlements";
import { defaultFeaturesForWorkspaceType } from "../src/lib/products/feature-entitlements";
import { grantsForPlatformProduct, listPlatformPurchasableProducts } from "../src/lib/products/platform-billing-catalog";
import { renderMctbMessageTemplate, resolveMctbMessageTemplate } from "../src/lib/mctb/message-template";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";

const businessDefaults = defaultFeaturesForWorkspaceType("BUSINESS");
assert.ok(businessDefaults.some((d) => d.feature === "mctb" && d.status === "inactive"));

const nav = buildVoiceNav({
  productFeatures: {
    mctb: "active",
    smart_routing: "inactive",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  },
});
const labels = nav.map((i) => i.label);
assert.ok(labels.includes("Missed Calls"));
assert.ok(labels.includes("Conversations"));
assert.equal(nav.find((i) => i.label === "Conversations")?.href, "/inbox");
assert.ok(labels.includes("Buy Numbers"));
assert.ok(nav.some((i) => i.href === "/voice/analytics" && i.label === "Analytics"));
assert.ok(!nav.some((i) => i.href?.startsWith("/smart-routing")));
assert.ok(!labels.includes("Visual Voicemail"));
assert.ok(!labels.includes("Callback Requests"));
assert.ok(!labels.includes("Business Call Back"));

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

(async () => {
  assert.equal(await workspaceHasAdminFullEntitlements("ws-test", { isPlatformAdmin: true }), true);
  assert.ok(listPlatformPurchasableProducts().length >= 1);
  const mctbGrant = grantsForPlatformProduct("mctb");
  assert.ok(mctbGrant.length >= 1);
  console.log("test-transovo-platform: ok");
})();
