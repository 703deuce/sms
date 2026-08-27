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
assert.ok(srNav.some((i) => i.href === "/smart-routing/activity"));
assert.ok(!srNav.some((i) => i.label === "Routing Analytics"));

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
assert.ok(labels.includes("Missed Calls"));
assert.ok(labels.includes("Inbox"));
assert.ok(labels.includes("Campaigns"));
assert.equal(nav.find((i) => i.label === "Inbox")?.href, "/inbox");
assert.ok(labels.includes("Visual Voicemail"));
const mctbStart = labels.indexOf("Missed Calls");
assert.ok(mctbStart >= 0 && labels.indexOf("Visual Voicemail") > mctbStart);
assert.ok(labels.includes("Buy Numbers"));
assert.ok(labels.includes("Integrations"));
assert.ok(labels.includes("Imports"));
assert.ok(!labels.includes("Surveys"));
assert.ok(!labels.includes("Callback Requests"));
assert.ok(!labels.includes("Transcription"));
assert.ok(!nav.some((i) => i.href === "/voice/analytics" && i.sectionLabel === "Manage"));
assert.equal(nav.find((i) => i.label === "Compliance")?.href, "/compliance");

const prevFocused = process.env.TRANSOVO_MCTB_FOCUSED_NAV;
process.env.TRANSOVO_MCTB_FOCUSED_NAV = "false";
const srOnly = buildVoiceNav({
  productFeatures: {
    mctb: "inactive",
    smart_routing: "active",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
    mass_texting: "inactive",
    call_forwarding: "inactive",
    ai_transcription: "inactive",
  },
});
process.env.TRANSOVO_MCTB_FOCUSED_NAV = prevFocused;
assert.ok(!srOnly.some((i) => i.label === "Missed Calls"));
assert.ok(srOnly.some((i) => i.href === "/smart-routing" && i.label === "Overview"));
assert.ok(srOnly.some((i) => i.href === "/smart-routing/activity" && i.label === "Activity"));

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
const dashboardIdx = mtLabels.indexOf("Dashboard");
const mctbIdx = mtLabels.indexOf("Missed Calls");
assert.ok(dashboardIdx >= 0, "Dashboard on unified menu");
assert.ok(mctbIdx > dashboardIdx, "MCTB section appears after dashboard");
assert.ok(mtLabels.includes("Campaigns"), "SMS campaigns on unified menu");
assert.ok(mtLabels.includes("Flows"), "SMS automation flows on unified menu");
assert.ok(mtLabels.includes("Flow builder"), "SMS automation builder on unified menu");
assert.ok(mtLabels.includes("Keywords"), "Lead capture keywords on unified menu");
assert.ok(massTextUnified.some((i) => i.sectionLabel === "SMS"));
assert.ok(massTextUnified.some((i) => i.sectionLabel === "Missed Call Text Back"));
assert.ok(
  !massTextUnified.some(
    (i) => i.label === "Visual Voicemail" && i.sectionLabel === "Add-ons",
  ),
  "Visual voicemail lives under MCTB, not add-ons, when MCTB is active",
);
assert.ok(
  massTextUnified.some((i) => i.label === "Visual Voicemail"),
  "Visual Voicemail nested under MCTB",
);
const mctbStartUnified = mtLabels.indexOf("Missed Calls");
assert.ok(mctbStartUnified >= 0 && mtLabels.indexOf("Visual Voicemail") > mctbStartUnified);
assert.equal(mtLabels.filter((l) => l === "Inbox").length, 1);

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
