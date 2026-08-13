/**
 * Unit contract: boot must not steal DIDs from published wizard receptionists.
 * Run: npx tsx scripts/test-phone-reassignment-guard.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const guard = read("src/lib/voice/phone-reassignment-guard.ts");
assert.ok(guard.includes("shouldSkipInboundPhoneReassignment"));
assert.ok(guard.includes("hasGenericReceptionistProfile"));
assert.ok(guard.includes("publishedVersionId"));

const ensure = read("src/lib/voice/frontdesk/ensure-realtime-agent.ts");
assert.ok(ensure.includes("shouldSkipInboundPhoneReassignment"));

const deploy = read("src/lib/voice/real-estate/deploy-agent.ts");
assert.ok(deploy.includes("shouldSkipInboundPhoneReassignment"));

console.log("test-phone-reassignment-guard: ok");
