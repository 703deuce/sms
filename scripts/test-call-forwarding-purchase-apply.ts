/**
 * Verifies applyCallHandlingAfterPurchase for call_forwarding (no Telnyx purchase).
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-call-forwarding-purchase-apply.ts
 */
import { randomBytes } from "crypto";
import { getPrisma } from "../src/lib/db";
import { applyCallHandlingAfterPurchase } from "../src/lib/numbers/call-handling-mode";
import { readCallHandlingMode } from "../src/lib/numbers/call-handling-mode-shared";
import { hasWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";

async function main() {
  const prisma = getPrisma();
  const suffix = randomBytes(4).toString("hex");
  const workspace = await prisma.workspace.create({
    data: { name: `CF Purchase ${suffix}`, slug: `cf-purchase-${suffix}`, type: "BUSINESS" },
  });

  const e164 = `+1415555${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId: workspace.id,
      e164,
      type: "Local",
      provider: "telnyx",
      providerNumberId: `test-${suffix}`,
      status: "Active",
      settingsJson: {},
    },
  });

  await applyCallHandlingAfterPurchase(workspace.id, pn.id, "call_forwarding");

  const row = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
  if (readCallHandlingMode(row!.settingsJson) !== "call_forwarding") {
    throw new Error("callHandlingMode not call_forwarding after purchase apply");
  }
  if (row!.settingsJson?.routingOwner !== "call_forwarding") {
    throw new Error("routingOwner not call_forwarding");
  }

  const entitled = await hasWorkspaceProductFeature(workspace.id, "call_forwarding");
  if (!entitled) {
    const row = await prisma.workspaceProductFeature.findFirst({
      where: { workspaceId: workspace.id, featureKey: "CALL_FORWARDING" },
    });
    if (!row || row.status !== "TRIAL" && row.status !== "ACTIVE") {
      throw new Error("call_forwarding entitlement not granted after apply");
    }
  }

  const ws = await prisma.callForwardingWorkspaceSettings.findUnique({
    where: { workspaceId: workspace.id },
  });
  if (!ws?.assignedPhoneNumberId || ws.assignedPhoneNumberId !== pn.id) {
    throw new Error("workspace settings not linked to number");
  }

  await prisma.callForwardingWorkspaceSettings.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });

  console.log("test:call-forwarding-purchase-apply ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
