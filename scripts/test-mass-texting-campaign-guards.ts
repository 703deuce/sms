/**
 * Mass Texting campaign launch guard wiring checks.
 * Run: npx tsx scripts/test-mass-texting-campaign-guards.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const guards = read("src/lib/mass-texting/campaign-guards.ts");
assert.ok(guards.includes("canLegacyActivateCampaign"), "legacy activate guard exists");
assert.ok(guards.includes("canAutoActivateScheduledCampaign"), "scheduled auto-activate guard exists");
assert.ok(guards.includes("massTextingRequiresLaunchAudit"), "mass texting launch audit helper exists");

const route = read("src/app/api/campaigns/route.ts");
assert.ok(route.includes("launchCampaignWithAudit"), "campaign routes mass-text activate through launch audit");
assert.ok(route.includes("isMassTextingCampaign"), "campaign routes detect mass texting workspaces");

const processor = read("src/lib/campaigns/campaign-processor.ts");
assert.ok(
  processor.includes("campaignLaunchAudit") || processor.includes("canAutoActivateScheduledCampaign"),
  "processor blocks scheduled mass-text send without launch audit",
);

const sequence = read("src/lib/campaigns/sequence-runner.ts");
assert.ok(
  sequence.includes("campaignLaunchAudit") || sequence.includes("canAutoActivateScheduledCampaign"),
  "sequence runner blocks scheduled mass-text send without launch audit",
);

const actions = read("src/components/campaigns/campaign-actions.tsx");
assert.ok(actions.includes("isMassText"), "campaign actions hide bypass activate button for mass texting");

const launchReview = read("src/components/campaigns/campaign-launch-review.tsx");
assert.ok(launchReview.includes("launch-review"), "launch review UI loads pre-send review");
assert.ok(launchReview.includes("/api/mass-texting/campaigns/${campaignId}/launch"), "launch review posts to audited mass-texting launch route");

const launchReviewRoute = read("src/app/api/campaigns/[id]/launch-review/route.ts");
assert.ok(
  launchReviewRoute.includes("requireMassTextingWorkspace"),
  "launch-review requires mass texting entitlement",
);

const recurrence = read("src/lib/campaigns/recurrence.ts");
assert.ok(
  recurrence.includes("massTextingRequiresLaunchAudit"),
  "recurring campaigns respect mass texting launch audit",
);

const media = read("src/lib/mass-texting/campaign-media.ts");
assert.ok(media.includes("validateCampaignMediaConfig"), "MMS validation helper exists");

console.log("test-mass-texting-campaign-guards: ok");
