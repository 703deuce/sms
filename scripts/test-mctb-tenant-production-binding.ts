/**
 * Tenant production binding contracts — platform demo removed.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-tenant-production-binding.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ensureMctbTenantProductionBinding,
  resolveLinkedPlatformDemoTenantWorkspace,
} from "@/lib/mctb/tenant-production-binding";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPlatformDemoPhoneRecord } from "@/lib/mctb/platform-demo-access";

const TENANT_WORKSPACE = "ws_1";
const OWNED_571 = "cmsgtjms84g6l2h0o255w1e3v";

const setupSrc = readFileSync(resolve("src/app/api/mctb/setup/route.ts"), "utf8");
const bootstrapSrc = readFileSync(resolve("src/lib/mctb/admin-test/bootstrap.ts"), "utf8");

assert.match(
  setupSrc,
  /ensureMctbTenantProductionBinding/,
  "setup save must bind tenant production state",
);
assert.match(
  bootstrapSrc,
  /ensureMctbTenantProductionBinding/,
  "admin bootstrap must bind tenant production state",
);

async function main() {
  assert.equal(await getPlatformDemoPhoneRecord(), null, "platform demo phone must be removed");

  const ownedBinding = await ensureMctbTenantProductionBinding({
    workspaceId: TENANT_WORKSPACE,
    phoneNumberId: OWNED_571,
    businessLineE164: process.env.MCTB_TEST_BUSINESS_E164 || "+15555550100",
  });
  assert.equal(ownedBinding.platformDemoLinked, false);
  assert.equal(ownedBinding.phoneNumberId, OWNED_571);
  const ownedRuntime = await loadMissedCallTextConfig(TENANT_WORKSPACE);
  assert.equal(ownedRuntime.phoneNumberId, OWNED_571);

  const routed = await resolveLinkedPlatformDemoTenantWorkspace("+15714073615");
  assert.equal(routed, null, "platform demo tenant routing must be disabled");

  console.log("test-mctb-tenant-production-binding: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
