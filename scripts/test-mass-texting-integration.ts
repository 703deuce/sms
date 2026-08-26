/**
 * Mass Texting integration wiring checks.
 * Run: npx tsx scripts/test-mass-texting-integration.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// /sms routes must not be redirected away in middleware
const middleware = read("src/middleware.ts");
assert.doesNotMatch(
  middleware,
  /pathname === "\/sms".*slice\(4\)/s,
  "middleware must not strip /sms prefix",
);
assert.ok(middleware.includes('"/mass-texting"'), "mass-texting landing must be public");

// Access guard allows hasSms when standalone hidden
const guards = read("src/lib/products/access-guards.ts");
assert.ok(
  guards.includes("if (access.hasSms) return null"),
  "SMS paths allowed when hasSms (incl. mass_texting feature)",
);

// Campaign send wired to mass text path
const send = read("src/lib/campaigns/campaign-message-send.ts");
assert.ok(send.includes("isMassTextingCampaign"), "campaign send checks mass text campaigns");
assert.ok(send.includes("ensureProductConversation"), "outbound tags mass text conversations");
assert.ok(send.includes("!massTextCampaign"), "legacy credit deduct skipped for mass text");

// Import attestation wired
const importForm = read("src/components/contacts/contact-import-form.tsx");
assert.ok(importForm.includes("/api/mass-texting/import-attestation"));
assert.ok(importForm.includes("marketingImport"));

// Product open grants mass_texting
const productOpen = read("src/app/api/products/open/route.ts");
assert.ok(productOpen.includes('grantWorkspaceProductFeature(workspace.workspaceId, "mass_texting"'));

console.log("test-mass-texting-integration: ok");
