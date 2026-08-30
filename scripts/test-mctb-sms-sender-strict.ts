/**
 * MCTB SMS sender must use only numbers saved in setup config.
 * Run: npx tsx scripts/test-mctb-sms-sender-strict.ts
 */
import assert from "node:assert/strict";
import {
  resolveConfiguredMctbPhoneForWorkspace,
  resolveMctbSmsSender,
} from "@/lib/agents/missed-call-text-back/sms-sender";
import { isNumberPurchaseAllowed } from "@/lib/numbers/number-purchase-guard";

assert.equal(isNumberPurchaseAllowed(), true, "expected purchases allowed outside CI/test");

async function main() {
  const PLATFORM_DEMO_ID = "cmsgtjms84g6l2h0o255w1e3v";
  const WS_1 = "ws_1";

  const linked = await resolveConfiguredMctbPhoneForWorkspace(WS_1, PLATFORM_DEMO_ID);
  assert.ok(linked, "ws_1 should resolve linked platform demo 571 from setup id");
  assert.equal(linked?.e164, "+15714073615");

  const sender = await resolveMctbSmsSender({
    workspaceId: WS_1,
    config: {
      phoneNumberId: PLATFORM_DEMO_ID,
      smsPhoneNumberId: PLATFORM_DEMO_ID,
    },
  });
  assert.ok(sender, "sender should resolve from setup config");
  assert.equal(sender?.e164, "+15714073615");
  assert.equal(sender?.source, "phone_number_id");

  const blocked = await resolveMctbSmsSender({
    workspaceId: WS_1,
    config: {
      phoneNumberId: null,
      smsPhoneNumberId: null,
    },
  });
  assert.equal(blocked, null, "must not fall back when setup has no configured number");

  console.log("test:mctb-sms-sender-strict ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
