/**
 * Mass Texting A2P sync from workspace registration.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-a2p-sync.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { assertMassTextMarketingSendAllowed } from "../src/lib/mass-texting/a2p-enforcement";
import {
  isMassTextA2pApprovedStatus,
  resolveMassTextA2pStatus,
  syncMassTextA2pFromWorkspaceRegistration,
} from "../src/lib/mass-texting/a2p-status";

function suffix() {
  return randomUUID().slice(0, 8);
}

async function main() {
  const prisma = getPrisma();
  const tag = suffix();
  const workspace = await prisma.workspace.create({
    data: { name: `A2P Sync ${tag}`, slug: `a2p-sync-${tag}` },
  });
  const workspaceId = workspace.id;

  await prisma.messagingRegistration.create({
    data: {
      workspaceId,
      overallStatus: "ready",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+15551234000",
      brandStatus: "approved",
      campaignStatus: "approved",
    },
  });
  await prisma.phoneNumber.create({
    data: {
      workspaceId,
      e164: "+15551234000",
      type: "local",
      friendlyName: "Shared",
      status: "Active",
      a2pStatus: "APPROVED",
    },
  });

  const before = await prisma.messagingProductRegistration.findUnique({
    where: {
      workspaceId_productUseCase: { workspaceId, productUseCase: "MASS_TEXT_MARKETING" },
    },
  });
  assert.equal(before, null);

  const synced = await syncMassTextA2pFromWorkspaceRegistration(workspaceId);
  assert.ok(synced);
  assert.equal(isMassTextA2pApprovedStatus(synced?.overallStatus), true);
  assert.equal(synced?.messagingEnabled, true);
  assert.equal(synced?.phoneAttached, true);
  assert.equal(synced?.phoneE164, "+15551234000");

  const status = await resolveMassTextA2pStatus(workspaceId);
  assert.equal(isMassTextA2pApprovedStatus(status), true);

  const gate = await assertMassTextMarketingSendAllowed(workspaceId);
  assert.equal(gate.allowed, true);

  await prisma.workspace.delete({ where: { id: workspaceId } });
  console.log("test-mass-texting-a2p-sync: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
