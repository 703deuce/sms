#!/usr/bin/env tsx
/**
 * MCTB sidebar IA — Pass 1 seven-destination nav (Voice via product switcher only).
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

const mctbNav = buildMctbV1Nav({ hasVoice: true, hasNumbers: true });
const mctbLabels = mctbNav.map((i) => i.label);
const mctbHrefs = collectNavHrefs(mctbNav);

assert.ok(!mctbLabels.includes("Calls"));
assert.ok(!mctbLabels.includes("AI Agent"));
assert.ok(!mctbLabels.includes("Conversations"));
assert.ok(mctbLabels.includes("Inbox"));
assert.ok(mctbLabels.includes("AI Recovery"));
assert.equal(mctbNav.find((i) => i.label === "Overview")?.href, MCTB_ROUTES.home);
assert.equal(mctbNav.find((i) => i.label === "AI Recovery")?.href, MCTB_ROUTES.aiRecovery);
assert.ok(!mctbHrefs.includes("/voice/calls"));
assert.ok(!mctbHrefs.includes("/mctb/voice-agent"));
assert.ok(mctbHrefs.includes("/voice/numbers"));

const mctbOnly = buildMctbV1Nav({ hasVoice: false });
const mctbOnlyLabels = mctbOnly.map((i) => i.label);
assert.ok(!mctbOnlyLabels.includes("Calls"));
assert.ok(!mctbOnlyLabels.includes("AI Agent"));
assert.equal(mctbOnly.find((i) => i.label === "Inbox")?.href, MCTB_ROUTES.conversations);

const mobile = buildMctbV1MobileNav({ hasVoice: true });
assert.deepEqual(mobile.map((i) => i.label), ["Home", "Missed", "Inbox", "Setup"]);

assert.ok(isMctbBundledAiReceptionistPath("/voice/calls"));
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

assert.equal(MCTB_ROUTES.aiRecovery, "/mctb/ai-recovery");

console.log("test-mctb-nav-ia: OK");
