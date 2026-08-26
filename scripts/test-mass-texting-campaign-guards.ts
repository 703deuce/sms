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

const route = read("src/app/api/campaigns/route.ts");
assert.ok(route.includes("canLegacyActivateCampaign"), "PATCH route uses launch guard");
assert.ok(route.includes("massTextingRequiresLaunchAudit"), "POST route blocks activate for mass texting");

const processor = read("src/lib/campaigns/campaign-processor.ts");
assert.ok(processor.includes("canAutoActivateScheduledCampaign"), "processor respects launch audit");

const sequence = read("src/lib/campaigns/sequence-runner.ts");
assert.ok(sequence.includes("canAutoActivateScheduledCampaign"), "sequence runner respects launch audit");

const actions = read("src/components/campaigns/campaign-actions.tsx");
assert.ok(actions.includes("massTexting"), "campaign actions hide bypass activate button");

const launchReview = read("src/components/campaigns/campaign-launch-review.tsx");
assert.ok(launchReview.includes("massTexting"), "launch review gated to mass texting");
assert.ok(launchReview.includes("launchIdempotencyKey"), "stable launch idempotency key");

const launchReviewRoute = read("src/app/api/campaigns/[id]/launch-review/route.ts");
assert.ok(
  launchReviewRoute.includes("requireMassTextingWorkspace"),
  "launch-review requires mass texting entitlement",
);

const media = read("src/lib/mass-texting/campaign-media.ts");
assert.ok(media.includes("validateCampaignMediaConfig"), "MMS validation helper exists");

console.log("test-mass-texting-campaign-guards: ok");
