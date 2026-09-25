/**
 * Product shell + V1 Appointments + MCTB navigation structure.
 * Run: npx tsx scripts/test-product-shell.ts
 */
import assert from "node:assert/strict";
import {
  aiAfterHoursShellHome,
  appointmentsProductShellHome,
  isExplicitAppointmentsShellPath,
  isExplicitMctbShellPath,
  isExplicitMassSmsShellPath,
  productShellLabel,
  resolveProductShellFromPath,
  shouldShowProductSwitcher,
  visibleProductShells,
} from "../src/lib/products/product-shell";
import { buildAiAfterHoursNav } from "../src/lib/products/ai-after-hours-nav";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import { resolveProductSidebarNav } from "../src/lib/products/resolve-product-nav";
import { isAiAfterHoursEntitled, AI_AFTER_HOURS_DISPLAY_NAME } from "../src/lib/products/ai-after-hours";

assert.equal(productShellLabel("appointments"), "Appointments");
assert.equal(productShellLabel("mass_sms"), "SMS");
assert.equal(productShellLabel("mctb"), "Missed Call Text Back");
assert.equal(productShellLabel("ai_after_hours"), AI_AFTER_HOURS_DISPLAY_NAME);

assert.equal(resolveProductShellFromPath("/appointments/overview"), "appointments");
assert.equal(resolveProductShellFromPath("/appointments/calendar"), "appointments");
assert.equal(resolveProductShellFromPath("/voice/missed-calls"), "mctb");
assert.equal(resolveProductShellFromPath("/mctb"), "mctb");
assert.equal(resolveProductShellFromPath("/mctb/missed-calls"), "mctb");
assert.equal(resolveProductShellFromPath("/personal/voicemail"), null);
assert.equal(resolveProductShellFromPath("/voice/agents"), "ai_after_hours");
assert.equal(resolveProductShellFromPath("/voice/overview"), "ai_after_hours");
assert.equal(resolveProductShellFromPath("/settings"), null);
assert.equal(resolveProductShellFromPath("/conversations"), null);

assert.ok(isExplicitMctbShellPath("/voice/setup"));
assert.ok(isExplicitAppointmentsShellPath("/appointments/types"));
assert.ok(!isExplicitMassSmsShellPath("/conversations"));

assert.equal(appointmentsProductShellHome(), "/appointments/overview");
assert.equal(aiAfterHoursShellHome(), "/voice/overview");

const v1Shells = visibleProductShells({
  hasMassSms: true,
  hasMctb: true,
  hasAiAfterHours: true,
});
assert.deepEqual(v1Shells, ["appointments", "mctb"]);

assert.ok(
  shouldShowProductSwitcher({ hasMassSms: true, hasMctb: true, hasAiAfterHours: false }),
);
assert.ok(
  !shouldShowProductSwitcher({ hasMassSms: false, hasMctb: false, hasAiAfterHours: false }),
);

const mctbNav = buildMctbV1Nav({ hasVoice: true, hasNumbers: true });
const mctbLabels = mctbNav.map((i) => i.label);

const mctbNavFromPath = resolveProductSidebarNav({
  pathname: "/mctb/missed-calls",
  multiProduct: false,
  productShell: "appointments",
  hasMctb: true,
  hasVoice: true,
  hasNumbers: true,
});
assert.equal(mctbNavFromPath.map((i) => i.label).join(","), mctbLabels.join(","));
assert.ok(mctbLabels.includes("Overview"));
assert.ok(mctbLabels.includes("Missed Calls"));
assert.ok(mctbLabels.includes("Inbox"));
assert.ok(mctbLabels.includes("AI Recovery"));
assert.ok(!mctbLabels.includes("Calls"));
assert.ok(!mctbLabels.includes("AI Agent"));
assert.ok(mctbLabels.includes("Voicemail"));
assert.ok(mctbLabels.includes("Analytics"));
assert.ok(mctbLabels.includes("Setup"));
assert.ok(mctbLabels.includes("Integrations"));
assert.ok(mctbLabels.includes("Numbers"));
assert.ok(mctbLabels.includes("Settings"));
assert.ok(!mctbLabels.includes("Home"));
assert.ok(!mctbLabels.includes("Conversations"));
assert.ok(!mctbLabels.includes("Campaigns"));

const aiNav = buildAiAfterHoursNav({ primaryVoiceAgentId: "agent_1" });
const aiLabels = aiNav.map((i) => i.label);
assert.ok(aiLabels.includes("Overview"));
assert.ok(aiLabels.includes("AI Agent"));
assert.ok(!aiLabels.includes("Missed Calls"));

const smsNav = buildSmsPlatformNav();
assert.ok(smsNav.find((i) => i.label === "Conversations"));
assert.ok(!smsNav.find((i) => i.label === "Missed Calls"));

assert.equal(isAiAfterHoursEntitled(true), true);
assert.equal(isAiAfterHoursEntitled(false), false);

console.log("test-product-shell: ok");
