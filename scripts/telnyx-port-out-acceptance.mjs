#!/usr/bin/env node
/**
 * Telnyx port-out acceptance — lists open port-outs for a number and syncs state.
 *
 * Usage:
 *   WORKSPACE_ID=... PHONE_NUMBER_ID=... npx tsx scripts/telnyx-port-out-acceptance.mjs
 */
import { getPrisma } from "../src/lib/db.ts";
import { listTelnyxPortOutOrders, syncTelnyxPortOutOrdersForNumber } from "../src/lib/numbers/telnyx-port-out-service.ts";

const workspaceId = process.env.WORKSPACE_ID?.trim();
const phoneNumberId = process.env.PHONE_NUMBER_ID?.trim();

if (!workspaceId || !phoneNumberId) {
  console.error("Set WORKSPACE_ID and PHONE_NUMBER_ID");
  process.exit(1);
}

const prisma = getPrisma();
const row = await prisma.phoneNumber.findFirst({
  where: { id: phoneNumberId, workspaceId, provider: "telnyx" },
});
if (!row) {
  console.error("Telnyx number not found for workspace");
  process.exit(1);
}

const orders = await listTelnyxPortOutOrders({ phone: row.e164 }).catch((err) => {
  console.warn("listTelnyxPortOutOrders failed:", err);
  return [];
});

const sync = await syncTelnyxPortOutOrdersForNumber(workspaceId, phoneNumberId);

const portOutRequests = await prisma.portOutRequest.findMany({
  where: { workspaceId, phoneNumberId },
  orderBy: { createdAt: "desc" },
  take: 5,
});

const report = {
  e164: row.e164,
  provider: "telnyx",
  telnyxOrdersListed: orders.length,
  syncedWebhookEvents: sync.synced,
  portOutRequests: portOutRequests.map((r) => ({
    id: r.id,
    status: r.status,
    voicePortStatus: r.voicePortStatus,
    messagingPortStatus: r.messagingPortStatus,
    providerPortOutId: r.providerPortOutId,
    guaranteeEligible: r.guaranteeEligible,
  })),
  acceptanceChecklist: [
    "Customer initiated port-out in Transovo before carrier request",
    "Telnyx port-out webhook hits /api/telnyx/port-out with idempotency",
    "Matched intent auto-authorizes; unexpected requests create UNEXPECTED_PORT_REQUEST",
    "Voice and messaging port status tracked separately on PortOutRequest",
  ],
};

console.log(JSON.stringify(report, null, 2));
console.log("ACCEPTANCE INFO: review telnyxOrdersListed and portOutRequests above");
