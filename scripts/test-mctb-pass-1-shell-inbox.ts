#!/usr/bin/env tsx
/**
 * MCTB Pass 1 — shell/nav + inbox presentation helpers.
 * Run: npx tsx scripts/test-mctb-pass-1-shell-inbox.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildMctbV1Nav, buildMctbV1MobileNav } from "../src/lib/products/mctb-nav";
import { collectNavHrefs } from "../src/lib/nav";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import { isMctbInboxThread, isMctbProductSource } from "../src/lib/mctb/inbox/is-mctb-thread";
import {
  buildMctbCapturedFieldRows,
  deriveMctbAutomationIndicator,
  deriveMctbOperationalLabel,
} from "../src/lib/mctb/inbox/thread-presentation";
import { resolveProductSidebarNav } from "../src/lib/products/resolve-product-nav";
import { buildAiAfterHoursNav } from "../src/lib/products/ai-after-hours-nav";

const CORE_MCTB_LABELS = [
  "Overview",
  "Missed Calls",
  "Inbox",
  "AI Recovery",
  "Voicemail",
  "Analytics",
  "Setup",
];

const mctbNav = buildMctbV1Nav({ hasVoice: true, hasNumbers: true });
const sharedStart = mctbNav.findIndex((i) => i.sectionLabel === "Shared");
const coreSlice = sharedStart >= 0 ? mctbNav.slice(0, sharedStart) : mctbNav;
const labels = coreSlice.map((i) => i.label);
for (const label of CORE_MCTB_LABELS) {
  assert.ok(labels.includes(label), `MCTB nav missing ${label}`);
}
assert.equal(labels.filter((l) => l === "Overview").length, 1);

const hrefs = collectNavHrefs(mctbNav);
assert.ok(!hrefs.includes("/voice/calls"));
assert.ok(!hrefs.includes("/voice/overview"));
assert.ok(!hrefs.includes("/voice/inbound-routing"));
assert.ok(!hrefs.includes("/mctb/voice-agent"));
assert.equal(mctbNav.find((i) => i.label === "AI Recovery")?.href, MCTB_ROUTES.aiRecovery);
assert.equal(mctbNav.find((i) => i.label === "Inbox")?.href, MCTB_ROUTES.conversations);

const voiceNav = buildAiAfterHoursNav({ primaryVoiceAgentId: "a1" });
assert.ok(voiceNav.some((i) => i.label === "Calls" || i.href.includes("/voice/calls")));

const bothMctb = buildMctbV1Nav({ hasVoice: true });
assert.ok(!bothMctb.map((i) => i.label).includes("Calls"));

const mobile = buildMctbV1MobileNav({ hasVoice: true });
assert.deepEqual(mobile.map((i) => i.label), ["Home", "Missed", "Inbox", "Setup"]);

assert.ok(existsSync("src/app/(app)/mctb/ai-recovery/page.tsx"));
const legacyPage = readFileSync("src/app/(app)/mctb/ai-lead-recovery/page.tsx", "utf8");
assert.match(legacyPage, /aiRecovery|ai-recovery/);

assert.ok(isMctbProductSource("mctb"));
assert.ok(!isMctbProductSource("mass_text"));
assert.ok(isMctbInboxThread({ productSource: "mctb" }));
assert.ok(!isMctbInboxThread({ productSource: "manual" }));

assert.equal(deriveMctbOperationalLabel({ unread: true }), "Needs reply");
assert.equal(
  deriveMctbOperationalLabel({ followUpStatus: "needs_follow_up" }),
  "Needs callback",
);
assert.equal(deriveMctbAutomationIndicator({ automationState: "human_active" }), "Human active");
assert.equal(deriveMctbAutomationIndicator({ automationState: "automation_active" }), "AI active");

const rows = buildMctbCapturedFieldRows({
  caller_name: "Mike",
  service_reason: "Water heater",
});
assert.equal(rows.length, 2);
assert.ok(!buildMctbCapturedFieldRows({ caller_name: "" }).length);

const threadArea = readFileSync("src/components/inbox/conversations-thread-area.tsx", "utf8");
assert.match(threadArea, /MctbRecoveryContextPanel/);
assert.match(threadArea, /hideAutomationOwnership=\{mctbThread\}/);
assert.match(threadArea, /isMctbInboxThread/);

const mctbResolved = resolveProductSidebarNav({
  pathname: "/mctb/conversations",
  multiProduct: true,
  productShell: "mctb",
  hasMctb: true,
  hasVoice: true,
});
assert.ok(mctbResolved.some((i) => i.label === "AI Recovery"));

console.log("test-mctb-pass-1-shell-inbox: OK");
