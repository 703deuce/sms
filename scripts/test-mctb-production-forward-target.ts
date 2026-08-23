/**
 * Production forward target resolves from workspace-assigned number — never hardcoded.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-production-forward-target.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";

async function main() {
  const prisma = getPrisma();
  const e164 = `+1202${String(Date.now()).slice(-7)}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: "MCTB forward target test",
      slug: `mctb-fwd-target-${Date.now()}`,
      type: "BUSINESS",
    },
    select: { id: true },
  });

  const phone = await prisma.phoneNumber.create({
    data: {
      workspaceId: workspace.id,
      e164,
      type: "Local",
      provider: "telnyx",
      status: "Active",
      settingsJson: { mctbSipIngress: true, mctbRole: "customer_mctb" },
    },
    select: { id: true },
  });

  try {
    await prisma.missedCallTextConfig.create({
      data: {
        workspaceId: workspace.id,
        enabled: true,
        phoneNumberId: phone.id,
        messageTemplate: "test",
        delaySeconds: 0,
      },
    });

    const target = await getProductionMctbForwardTargetE164(workspace.id);
    assert.equal(target, e164);
    console.log("✓ test:production-forward-target-from-assigned-number");
  } finally {
    await prisma.missedCallTextConfig
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => undefined);
    await prisma.phoneNumber.delete({ where: { id: phone.id } }).catch(() => undefined);
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
  }

  console.log("\nProduction forward target tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
