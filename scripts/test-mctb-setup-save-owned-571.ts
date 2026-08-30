/**
 * Setup save must not rewrite owned 571 to platform-demo row id.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-setup-save-owned-571.ts
 */
import assert from "node:assert/strict";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { ensureMctbTenantProductionBinding } from "../src/lib/mctb/tenant-production-binding";
import { ensureDefaultTelnyxMctbAndSmsProvision } from "../src/lib/mctb/provisioning/dual-channel-repair";
import { getPlatformDemoPhoneRecord } from "../src/lib/mctb/platform-demo-access";

const WS = "ws_1";
const OWNED_571 = "cmsgtjms84g6l2h0o255w1e3v";

async function main() {
  const demo = await getPlatformDemoPhoneRecord();
  assert.ok(demo, "platform demo exists");
  assert.notEqual(OWNED_571, demo.phoneNumberId, "owned and demo rows must differ");

  await ensureDefaultTelnyxMctbAndSmsProvision({
    workspaceId: WS,
    phoneNumberId: OWNED_571,
  });

  const binding = await ensureMctbTenantProductionBinding({
    workspaceId: WS,
    phoneNumberId: OWNED_571,
    businessLineE164: process.env.MCTB_TEST_BUSINESS_E164 || "+15555550100",
  });

  assert.equal(binding.platformDemoLinked, false, "owned 571 must not link platform demo");
  assert.equal(binding.phoneNumberId, OWNED_571);

  const runtime = await loadMissedCallTextConfig(WS);
  assert.equal(
    runtime.phoneNumberId,
    OWNED_571,
    "setup binding must not overwrite owned phone id with platform demo row",
  );
  assert.equal(runtime.smsPhoneNumberId, OWNED_571);

  console.log("test-mctb-setup-save-owned-571: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
