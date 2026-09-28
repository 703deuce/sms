#!/usr/bin/env tsx
/**
 * MCTB Pass 6 — architecture freeze reconciliation (static).
 * Run: npx tsx scripts/test-mctb-pass-6-final-reconciliation.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import { resolveRemovedMctbSchedulingRedirect } from "../src/lib/mctb/removed-scheduling-routes";
import { MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI, MCTB_LAUNCH_COMPACT_OVERVIEW } from "../src/lib/mctb/launch-flags";

const root = join(process.cwd(), "src");

function readRoute(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

assert.ok(existsSync(join(root, "app/(app)/mctb/ai-recovery/page.tsx")));
assert.ok(readRoute("app/(app)/mctb/ai-recovery/page.tsx").includes("AiRecoverySettingsPage"));
assert.ok(!readRoute("app/(app)/mctb/ai-recovery/page.tsx").includes("AiLeadRecoveryPage"));

assert.ok(readRoute("app/(app)/mctb/ai-lead-recovery/page.tsx").includes("redirect"));
assert.ok(readRoute("app/(app)/mctb/ai-lead-recovery/page.tsx").includes(MCTB_ROUTES.aiRecovery));

assert.ok(readRoute("app/(app)/mctb/voice-agent/page.tsx").includes('redirect("/voice/agents")'));

assert.ok(readRoute("app/(app)/mctb/numbers/page.tsx").includes("open=manage"));

for (const legacy of [
  "app/(app)/mctb/setup/business-hours/page.tsx",
  "app/(app)/mctb/setup/follow-up/page.tsx",
]) {
  assert.ok(readRoute(legacy).includes("redirect"));
  assert.ok(readRoute(legacy).includes("setupRecovery"));
}

assert.ok(
  readRoute("app/(app)/mctb/setup/missed-call-rules/page.tsx").includes(
    "MctbSetupMissedCallRulesView",
  ),
);

assert.equal(resolveRemovedMctbSchedulingRedirect("/mctb/calendar"), "/appointments/calendar");
assert.equal(resolveRemovedMctbSchedulingRedirect("/mctb/appointments"), "/appointments");

const aiPage = readRoute("components/mctb/ai-recovery/ai-recovery-settings-page.tsx");
assert.ok(aiPage.includes("Business information"));
assert.ok(aiPage.includes("Information to collect"));
assert.ok(aiPage.includes("Booking link"));
assert.ok(!aiPage.includes("AI Lead Recovery"));

const nav = buildMctbV1Nav({ hasVoice: false });
const labels = nav.map((i) => i.label);
assert.ok(labels.includes("Conversations"));
assert.ok(labels.includes("Missed-Call Recovery"));
assert.ok(labels.includes("Text Back"));
assert.ok(!labels.includes("Setup"));
assert.ok(!labels.includes("Integrations"));

assert.equal(MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI, true);
assert.equal(MCTB_LAUNCH_COMPACT_OVERVIEW, true);

const analytics = readFileSync(join(process.cwd(), "src/lib/mctb/analytics.ts"), "utf8");
assert.ok(!analytics.includes("linksSent = textsSent"));
assert.ok(analytics.includes("BOOKING_LINK_SENT"));

console.log("test-mctb-pass-6-final-reconciliation: OK");
