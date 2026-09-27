#!/usr/bin/env tsx
/**
 * MCTB sidebar IA — dual product groups + shared routes.
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
import { isVoiceProductCustomerVisible } from "../src/lib/products/launch-product-availability";

const launchNav = buildMctbV1Nav({ hasVoice: true, hasNumbers: true });
const launchLabels = launchNav.map((i) => i.label);
const launchHrefs = collectNavHrefs(launchNav);

assert.equal(isVoiceProductCustomerVisible(), false, "default launch hides Voice from customer nav");
assert.ok(!launchLabels.includes("Calls"));
assert.ok(!launchLabels.includes("Receptionist"));
assert.ok(!launchLabels.includes("Business Knowledge"));
assert.ok(launchLabels.includes("Inbox"));
assert.ok(!launchLabels.includes("Conversations"));
assert.ok(!launchLabels.includes("Voice Agent"));
assert.ok(!launchNav.some((i) => i.sectionLabel === "AI Receptionist"));
assert.equal(launchNav.find((i) => i.label === "Overview" && i.sectionLabel === "Missed Call Text Back")?.href, "/mctb");
assert.ok(!launchHrefs.includes("/voice/receptionist"));
assert.ok(!launchHrefs.includes("/mctb/voice-agent"));
assert.equal(launchNav.find((i) => i.label === "AI Recovery")?.href, MCTB_ROUTES.aiRecovery);
const mctbStartIdx = launchNav.findIndex((i) => i.sectionLabel === "Missed Call Text Back");
const sharedIdx = launchNav.findIndex((i) => i.sectionLabel === "Shared");
const mctbPrimaryLabels = launchNav
  .slice(mctbStartIdx, sharedIdx >= 0 ? sharedIdx : undefined)
  .map((i) => i.label);
assert.deepEqual(mctbPrimaryLabels, [
  "Overview",
  "Missed Calls",
  "Inbox",
  "AI Recovery",
  "Voicemail",
  "Analytics",
  "Setup",
]);
assert.ok(launchHrefs.includes("/voice/numbers"));

const mctbOnly = buildMctbV1Nav({ hasVoice: false });
const mctbOnlyLabels = mctbOnly.map((i) => i.label);
assert.ok(!mctbOnlyLabels.includes("Calls"));
assert.ok(!mctbOnlyLabels.includes("Receptionist"));
assert.equal(mctbOnly.find((i) => i.label === "Inbox")?.href, MCTB_ROUTES.conversations);

const mobile = buildMctbV1MobileNav({ hasVoice: true });
assert.deepEqual(mobile.map((i) => i.label), ["Home", "Missed", "Inbox", "Setup"]);

assert.ok(isMctbBundledAiReceptionistPath("/voice/calls"));
assert.ok(isMctbBundledAiReceptionistPath("/mctb/voice-agent"));
assert.equal(isMctbUniversalChromeActive("/voice/calls", "ai_after_hours", { hasMctb: true }), true);

const mctbOnPayments = resolveProductSidebarNav({
  pathname: "/payments",
  multiProduct: false,
  productShell: "mctb",
  hasMctb: true,
  hasVoice: true,
});
assert.equal(mctbOnPayments.find((i) => i.sectionLabel === "Missed Call Text Back")?.label, "Overview");

if (!isMctbV1Primary()) {
  const apptOnPayments = resolveProductSidebarNav({
    pathname: "/payments",
    multiProduct: false,
    productShell: "appointments",
    hasMctb: false,
  });
  assert.ok(apptOnPayments.some((i) => i.label === "Home" || i.label === "Booking"));
}

assert.equal(MCTB_ROUTES.home, "/mctb");

console.log("test-mctb-nav-ia: OK");
