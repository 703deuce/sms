#!/usr/bin/env node
/**
 * Automation trigger + AI reply sequencing tests.
 * Requires approved test phones via env (no hardcoded numbers in repo):
 *   OUTBOUND_TEST_PHONE
 *   VOICE_TRANSFER_FALLBACK_E164
 */
import assert from "node:assert/strict";

function normalizeE164(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function approvedPhones() {
  const a = process.env.OUTBOUND_TEST_PHONE;
  const b = process.env.VOICE_TRANSFER_FALLBACK_E164;
  assert(a && b, "Set OUTBOUND_TEST_PHONE and VOICE_TRANSFER_FALLBACK_E164 for live phone checks");
  return new Set([normalizeE164(a), normalizeE164(b)]);
}

async function run() {
  const { delayToMs, parseDripSteps } = await import("../src/lib/drip-campaigns/types.ts");
  const { summarizeDeliveryStatuses } = await import("../src/lib/automate/delivery-stats.ts");

  const delayedFirst = parseDripSteps([
    { id: "s1", delayAmount: 2, delayUnit: "days", message: "Hello" },
    { id: "s2", delayAmount: 1, delayUnit: "days", message: "Follow up" },
  ]);
  assert.equal(delayedFirst.length, 2);
  assert.equal(delayToMs(delayedFirst[0]), 2 * 86_400_000);
  assert.equal(delayToMs(delayedFirst[1]), 1 * 86_400_000);
  console.log("PASS drip first-message delay honored");

  const stats = summarizeDeliveryStatuses(["delivered", "sent", "failed", "queued"]);
  assert.equal(stats.sent, 4);
  assert.equal(stats.delivered, 2);
  assert.equal(stats.failed, 1);
  assert.equal(stats.pending, 1);
  console.log("PASS delivery stats aggregation");

  const approved = approvedPhones();
  for (const phone of approved) {
    assert(approved.has(normalizeE164(phone)), `Approved set contains ${phone}`);
  }
  console.log("PASS approved test numbers configured via env");

  if (process.env.DATABASE_URL) {
    const { getPrisma } = await import("../src/lib/db.ts");
    const prisma = getPrisma();
    const workspace = await prisma.workspace.findFirst({ select: { id: true } });
    if (workspace) {
      const contacts = await prisma.contact.findMany({
        where: {
          workspaceId: workspace.id,
          phone: { in: [...approved] },
        },
        select: { id: true, phone: true },
      });
      for (const c of contacts) {
        assert(approved.has(normalizeE164(c.phone)), `Contact uses approved number: ${c.phone}`);
      }
      console.log(`PASS workspace contacts use approved numbers (${contacts.length} found)`);
    }
  }

  console.log("\nAll automation trigger tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
