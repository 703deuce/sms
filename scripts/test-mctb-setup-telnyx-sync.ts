/**
 * MCTB setup Telnyx messaging sync regression tests.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-setup-telnyx-sync.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { deriveRequiredActions } from "@/lib/compliance-helpers";
import { loadMctbSetupPhoneOptionsWithTelnyxSync } from "@/lib/mctb/setup-telnyx-messaging-sync";

async function main() {
  const phones = await loadMctbSetupPhoneOptionsWithTelnyxSync("ws_1");
  const local571 = phones.find((p) => p.e164 === "+15714073615");
  assert.ok(local571, "ws_1 should own +15714073615");

  assert.equal(
    isPhoneMessagingApproved(local571),
    true,
    "571 should be messaging-approved after Telnyx sync",
  );

  const adminFlags = await loadAdminMctbTestFlags("ws_1");
  const prisma = getPrisma();
  const reg = await prisma.messagingRegistration.findFirst({ where: { workspaceId: "ws_1" } });
  const requiredActions = deriveRequiredActions(reg as never, phones as never);
  const messagingReady = isMctbSetupMessagingReady({
    phoneNumbers: phones,
    requiredActions,
    adminFlags,
  });
  assert.equal(messagingReady, true, "ws_1 admin setup should be messaging-ready");

  const settings = local571.settingsJson as Record<string, unknown>;
  const compliance = settings.messagingCompliance as Record<string, unknown>;
  assert.equal(compliance.status, "APPROVED", "messagingCompliance should reflect Telnyx approval");
  assert.equal(settings.mctbRole, "customer_production", "reconcile should not use platform_demo role");

  console.log("✓ ws_1 Telnyx sync leaves 571 A2P approved");
  console.log("✓ ws_1 MCTB setup messaging-ready after sync");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
