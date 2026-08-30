/**
 * Tenant production binding + platform demo routing contracts.
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
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  getPlatformDemoPhoneRecord,
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access";

const PLATFORM_OWNER = "cmt2zyg4l43373s0f146b442h";
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
  const demo = await getPlatformDemoPhoneRecord();
  assert.ok(demo, "platform demo phone must exist");

  const ownedBinding = await ensureMctbTenantProductionBinding({
    workspaceId: TENANT_WORKSPACE,
    phoneNumberId: OWNED_571,
    businessLineE164: process.env.MCTB_TEST_BUSINESS_E164 || "+15555550100",
  });
  assert.equal(ownedBinding.platformDemoLinked, false);
  assert.equal(ownedBinding.phoneNumberId, OWNED_571);
  const ownedRuntime = await loadMissedCallTextConfig(TENANT_WORKSPACE);
  assert.equal(ownedRuntime.phoneNumberId, OWNED_571);

  const binding = await ensureMctbTenantProductionBinding({
    workspaceId: TENANT_WORKSPACE,
    phoneNumberId: demo.phoneNumberId,
    businessLineE164: process.env.MCTB_TEST_BUSINESS_E164 || "+15555550100",
  });
  assert.equal(binding.ok, true);
  assert.equal(binding.platformDemoLinked, true);
  assert.equal(binding.phoneNumberId, demo.phoneNumberId);
  assert.equal(binding.forwardingConnected, true);

  const refreshedDemo = await getPlatformDemoPhoneRecord();
  const linked = readAdminTestWorkspaceIds(refreshedDemo?.settingsJson);
  assert.ok(
    linked.includes(TENANT_WORKSPACE),
    "tenant workspace must be linked on platform demo phone after explicit demo selection",
  );

  const runtime = await loadMissedCallTextConfig(TENANT_WORKSPACE);
  assert.equal(runtime.phoneNumberId, demo.phoneNumberId);

  const routed = await resolveLinkedPlatformDemoTenantWorkspace("+15714073615");
  assert.equal(routed, TENANT_WORKSPACE);

  const withoutDiversion = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: process.env.MCTB_TEST_CALLER_E164 || "+15555550199",
    businessE164: "+15714073615",
    forwardedFrom: null,
  });
  assert.equal(withoutDiversion.workspaceId, TENANT_WORKSPACE);
  assert.notEqual(withoutDiversion.workspaceId, PLATFORM_OWNER);

  console.log("test-mctb-tenant-production-binding: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
