#!/usr/bin/env tsx
/**
 * MCTB launch sidebar IA — Activity / Configure groups.
 * Run: npx tsx scripts/test-mctb-nav-ia.ts
 */
import assert from "node:assert/strict";
import { buildMctbV1Nav, buildMctbV1MobileNav } from "../src/lib/products/mctb-nav";
import { collectNavHrefs } from "../src/lib/nav";
import { resolveProductSidebarNav } from "../src/lib/products/resolve-product-nav";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import { isMctbV1Primary } from "../src/lib/workspace/platform-launch";
import { isMctbUniversalChromeActive } from "../src/lib/mctb/universal-shell";
import { isMctbBundledAiReceptionistPath } from "../src/lib/products/mctb-bundled-receptionist-paths";
import { resolveMctbSetupIaRedirect } from "../src/lib/mctb/setup-ia-redirects";
import { findBestNavMatch } from "../src/lib/nav-active";
import { mapProductionNavToKimi } from "../src/components/kimi/sidebar/map-nav";
import { resolveCustomerNavSections } from "../src/newui-transplant/lib/nav";

const launchNav = buildMctbV1Nav({ hasVoice: true, hasNumbers: true });
const launchLabels = launchNav.map((i) => i.label);
const launchHrefs = collectNavHrefs(launchNav);

assert.ok(!launchLabels.includes("Setup"));
assert.ok(!launchLabels.includes("Integrations"));
assert.ok(!launchLabels.includes("Numbers"));
assert.ok(!launchLabels.includes("Inbox"));
assert.ok(launchLabels.includes("Conversations"));
assert.ok(launchLabels.includes("Missed-Call Recovery"));
assert.ok(launchLabels.includes("Text Back"));
assert.ok(launchLabels.includes("Phone & Forwarding"));
assert.ok(launchLabels.includes("Help"));

const activityIdx = launchNav.findIndex((i) => i.sectionLabel === "Activity");
const configureIdx = launchNav.findIndex((i) => i.sectionLabel === "Configure");
assert.ok(activityIdx >= 0);
assert.ok(configureIdx > activityIdx);

const activityLabels = launchNav
  .slice(activityIdx, configureIdx)
  .map((i) => i.label);
assert.deepEqual(activityLabels, ["Missed Calls", "Conversations", "Voicemail", "Analytics"]);

const configureLabels = launchNav
  .slice(configureIdx, launchNav.findIndex((i) => i.label === "Settings"))
  .map((i) => i.label);
assert.deepEqual(configureLabels, [
  "Missed-Call Recovery",
  "Text Back",
  "AI Recovery",
  "Notifications",
  "Phone & Forwarding",
]);

assert.equal(launchNav.find((i) => i.label === "Overview")?.href, "/mctb");
assert.equal(launchNav.find((i) => i.label === "AI Recovery")?.href, MCTB_ROUTES.aiRecovery);
assert.ok(!launchHrefs.includes("/voice/numbers"));
assert.ok(!launchHrefs.includes(MCTB_ROUTES.integrations));

const mctbOnly = buildMctbV1Nav({ hasVoice: false });
assert.equal(mctbOnly.find((i) => i.label === "Conversations")?.href, MCTB_ROUTES.conversations);

const mobile = buildMctbV1MobileNav({ hasVoice: true });
assert.deepEqual(mobile.map((i) => i.label), ["Home", "Missed", "Chats", "Configure"]);

const opusSections = resolveCustomerNavSections();
const opusLabels = opusSections.flatMap((s) => s.items.map((i) => i.label));
assert.ok(!opusLabels.includes("Setup"));
assert.ok(!opusLabels.includes("Inbox"));
assert.ok(opusLabels.includes("Conversations"));
assert.ok(opusSections.some((s) => s.label === "Activity"));
assert.ok(opusSections.some((s) => s.label === "Configure"));

assert.ok(isMctbBundledAiReceptionistPath("/voice/calls"));
assert.equal(isMctbUniversalChromeActive("/voice/calls", "ai_after_hours", { hasMctb: true }), true);

const mctbOnPayments = resolveProductSidebarNav({
  pathname: "/payments",
  multiProduct: false,
  productShell: "mctb",
  hasMctb: true,
  hasVoice: true,
});
assert.equal(mctbOnPayments.find((i) => i.label === "Overview")?.href, "/mctb");

if (!isMctbV1Primary()) {
  const apptOnPayments = resolveProductSidebarNav({
    pathname: "/payments",
    multiProduct: false,
    productShell: "appointments",
    hasMctb: false,
  });
  assert.ok(apptOnPayments.some((i) => i.label === "Home" || i.label === "Booking"));
}

assert.equal(
  resolveMctbSetupIaRedirect(MCTB_ROUTES.setupRecovery),
  `${MCTB_ROUTES.missedCallRecovery}?tab=general`,
);
assert.equal(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupLinks), `${MCTB_ROUTES.textBack}?section=booking`);

const kimi = mapProductionNavToKimi(buildMctbV1Nav({ hasVoice: false }));
assert.equal(findBestNavMatch(kimi, "/mctb/missed-call-recovery")?.href, MCTB_ROUTES.missedCallRecovery);
assert.equal(findBestNavMatch(kimi, "/mctb/text-back")?.href, MCTB_ROUTES.textBack);
assert.equal(findBestNavMatch(kimi, "/mctb/voicemail", "?tab=greeting")?.href, MCTB_ROUTES.voicemail);

console.log("test-mctb-nav-ia: OK");
