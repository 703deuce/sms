/**
 * Integration matrix (mocked / static) for Reviews + platform sender completion.
 * Run: npx tsx scripts/test-reviews-full-integration-matrix.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// Database: no Supabase env in client
assert.doesNotThrow(() => {
  const src = read("src/lib/db/client.ts");
  assert.match(src, /createReputationDbClient/);
  assert.doesNotMatch(src, /createClient.*supabase/i);
});

// Inbound wired
assert.match(read("src/lib/messaging/platform-sms-inbound-dispatch.ts"), /routePlatformMassTextOrReviewInbound/);
assert.match(read("src/lib/messaging/platform-product-inbound.ts"), /storeReviewReply/);

// Dispatch uses Transovo queue
assert.match(read("src/lib/queue/dispatch.ts"), /transovoEnqueueJob/);
assert.match(read("src/lib/queue/dispatch.ts"), /handleJob/);

// Templates unified API
assert.match(read("src/app/api/templates/unified/route.ts"), /loadUnifiedTemplates/);

// Public UI
assert.match(read("src/app/(public)/tools/review-velocity/page.tsx"), /review-velocity\/check/);

function testReputationDbBuilder() {
  assert.match(read("src/lib/reputation/db/reputation-db.ts"), /createReputationDbClient/);
  assert.match(read("src/lib/reputation/db/reputation-db.ts"), /or\(expr: string\)/);
  assert.match(read("src/lib/reputation/db/reputation-db.ts"), /is\(col: string/);
}

function testInboundRouterStatic() {
  assert.match(read("src/lib/messaging/platform-product-inbound.ts"), /resolveMassTextInboundFromPlatformAssignment/);
  assert.match(read("src/lib/messaging/platform-product-inbound.ts"), /review_requests/);
}

async function main() {
  testReputationDbBuilder();
  testInboundRouterStatic();

  const { spawnSync } = await import("node:child_process");
  for (const script of [
    "scripts/test-reviews-platform-sender-integration.ts",
    "scripts/test-ar-platform-sender-isolation.ts",
  ]) {
    const r = spawnSync("npx", ["tsx", script], { stdio: "inherit", cwd: root });
    assert.equal(r.status, 0, `${script} failed`);
  }

  console.log("PASS test-reviews-full-integration-matrix");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
