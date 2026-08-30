/**
 * Product shell + AI After Hours nav structure.
 * Run: npx tsx scripts/test-product-shell.ts
 */
import assert from "node:assert/strict";
import {
  aiAfterHoursShellHome,
  isExplicitAiAfterHoursShellPath,
  isExplicitMctbShellPath,
  isExplicitMassSmsShellPath,
  productShellLabel,
  resolveProductShellFromPath,
  shouldShowProductSwitcher,
} from "../src/lib/products/product-shell";
import { buildAiAfterHoursNav } from "../src/lib/products/ai-after-hours-nav";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { isAiAfterHoursEntitled, AI_AFTER_HOURS_DISPLAY_NAME } from "../src/lib/products/ai-after-hours";

assert.equal(productShellLabel("mass_sms"), "SMS");
assert.equal(productShellLabel("mctb"), "Missed Call Text Back");
assert.equal(productShellLabel("ai_after_hours"), AI_AFTER_HOURS_DISPLAY_NAME);

assert.equal(resolveProductShellFromPath("/dashboard"), "mass_sms");
assert.equal(resolveProductShellFromPath("/voice/missed-calls"), "mctb");
assert.equal(resolveProductShellFromPath("/voice/agents"), "ai_after_hours");
assert.equal(resolveProductShellFromPath("/voice/overview"), "ai_after_hours");
assert.equal(resolveProductShellFromPath("/settings"), null);

assert.ok(isExplicitMassSmsShellPath("/conversations"));
assert.ok(isExplicitMctbShellPath("/voice/setup"));
assert.ok(isExplicitAiAfterHoursShellPath("/voice/calls"));
assert.ok(!isExplicitMctbShellPath("/voice/agents"));

assert.equal(aiAfterHoursShellHome(), "/voice/overview");

assert.ok(
  !shouldShowProductSwitcher({ hasMassSms: true, hasMctb: true, hasAiAfterHours: false }),
);
assert.ok(
  !shouldShowProductSwitcher({ hasMassSms: true, hasMctb: false, hasAiAfterHours: true }),
);

const aiNav = buildAiAfterHoursNav({ primaryVoiceAgentId: "agent_1" });
const aiLabels = aiNav.map((i) => i.label);
assert.ok(aiLabels.includes("Overview"));
assert.ok(aiLabels.includes("AI Agent"));
assert.ok(aiLabels.includes("Calls"));
assert.ok(aiLabels.includes("Knowledge"));
assert.ok(aiLabels.includes("Call Handling"));
assert.ok(aiLabels.includes("Numbers"));
assert.ok(!aiLabels.includes("Missed Calls"));

const smsNav = buildSmsPlatformNav();
assert.ok(smsNav.find((i) => i.label === "Conversations"));
assert.ok(!smsNav.find((i) => i.label === "Missed Calls"));

assert.equal(isAiAfterHoursEntitled(true), true);
assert.equal(isAiAfterHoursEntitled(false), false);

console.log("test-product-shell: ok");
