/**
 * Static + light runtime checks for Reviews restore + platform sender wiring.
 * Run: npx tsx scripts/test-reviews-platform-sender-integration.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

assert.match(read("src/lib/campaigns/campaign-message-send.ts"), /resolveSharedPlatformOutboundSender/);
assert.match(read("src/lib/reputation/review-sms-dispatch.ts"), /sendQuickSms/);
assert.match(read("src/lib/reviews/momentum-engine.ts"), /competitor-pool/);
assert.match(read("src/lib/products/business-messaging-nav.ts"), /Reviews/);
assert.match(read("src/app/r/[trackingToken]/route.ts"), /recordTrackingClick/);

async function main() {
  const { buildReviewMomentumCompetitorPool } = await import("../src/lib/reviews/competitor-pool.ts");
  const pool = buildReviewMomentumCompetitorPool([], { excludeName: "Acme" });
  assert.equal(pool.length, 0);

  const { parseMassMessagingSenderMode } = await import("../src/lib/messaging/sender-mode.ts");
  assert.equal(parseMassMessagingSenderMode("PLATFORM"), "PLATFORM");
  assert.equal(parseMassMessagingSenderMode("workspace"), "WORKSPACE");

  console.log("PASS test-reviews-platform-sender-integration");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
