/**
 * Setup save must keep owned 571 — never link platform demo row.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-setup-save-owned-571.ts
 */
import assert from "node:assert/strict";
import {
  ensureMctbTenantProductionBinding,
} from "@/lib/mctb/tenant-production-binding";
import { getPlatformDemoPhoneRecord } from "../src/lib/mctb/platform-demo-access";

const TENANT_WORKSPACE = "ws_1";
const OWNED_571 = "cmsgtjms84g6l2h0o255w1e3v";

async function main() {
  assert.equal(await getPlatformDemoPhoneRecord(), null);

  const binding = await ensureMctbTenantProductionBinding({
    workspaceId: TENANT_WORKSPACE,
    phoneNumberId: OWNED_571,
    businessLineE164: process.env.MCTB_TEST_BUSINESS_E164 || "+15555550100",
  });
  assert.equal(binding.platformDemoLinked, false, "owned 571 must not link platform demo");
  assert.equal(binding.phoneNumberId, OWNED_571);

  console.log("test-mctb-setup-save-owned-571: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
