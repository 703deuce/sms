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

const voiceNav = buildMctbV1Nav({ hasVoice: true, hasNumbers: true });
const voiceLabels = voiceNav.map((i) => i.label);
const voiceHrefs = collectNavHrefs(voiceNav);

assert.ok(voiceLabels.includes("Calls"));
assert.ok(voiceLabels.includes("AI Agent"));
assert.ok(voiceLabels.includes("Inbox"));
assert.ok(!voiceLabels.includes("Conversations"));
assert.ok(!voiceLabels.includes("Voice Agent"));
assert.equal(voiceNav.find((i) => i.label === "Overview" && i.sectionLabel === "AI Receptionist")?.href, "/voice/overview");
assert.equal(voiceNav.find((i) => i.label === "Overview" && i.sectionLabel === "Missed Call Text Back")?.href, "/mctb");
assert.equal(voiceNav.find((i) => i.label === "Call Rules")?.href, "/voice/inbound-routing");
assert.ok(voiceHrefs.includes("/voice/calls"));
assert.ok(voiceHrefs.includes("/voice/agents"));
assert.ok(!voiceHrefs.includes("/mctb/voice-agent"));
assert.equal(voiceNav.find((i) => i.label === "AI Recovery")?.href, MCTB_ROUTES.aiRecovery);
const mctbStartIdx = voiceNav.findIndex((i) => i.sectionLabel === "Missed Call Text Back");
const sharedIdx = voiceNav.findIndex((i) => i.sectionLabel === "Shared");
const mctbPrimaryLabels = voiceNav
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
assert.ok(voiceHrefs.includes("/voice/numbers"));

const mctbOnly = buildMctbV1Nav({ hasVoice: false });
const mctbOnlyLabels = mctbOnly.map((i) => i.label);
assert.ok(!mctbOnlyLabels.includes("Calls"));
assert.ok(!mctbOnlyLabels.includes("AI Agent"));
assert.equal(mctbOnly.find((i) => i.label === "Inbox")?.href, MCTB_ROUTES.conversations);

const mobile = buildMctbV1MobileNav({ hasVoice: true });
assert.deepEqual(mobile.map((i) => i.label), ["Home", "Missed", "Inbox", "Calls", "Setup"]);

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
