/**
 * MCTB API workspace scoping — missed-call detail and booking links must not cross tenants.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-api-workspace-isolation.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadMctbMissedCallDetailPayload } from "../src/lib/mctb/missed-call-detail-load";
import {
  createMctbBookingLink,
  deleteMctbBookingLink,
  updateMctbBookingLink,
} from "../src/lib/mctb/booking-links/service";

async function expectReject(fn: () => Promise<unknown>) {
  try {
    await fn();
    assert.fail("expected rejection");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL?.trim();
  if (!DATABASE_URL) {
    console.log("test-mctb-api-workspace-isolation: SKIP (no DATABASE_URL)");
    return;
  }

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  const wsA = `mctb_iso_a_${randomUUID().slice(0, 8)}`;
  const wsB = `mctb_iso_b_${randomUUID().slice(0, 8)}`;
  const eventId = randomUUID();

  for (const [id, name] of [[wsA, "A"], [wsB, "B"]] as const) {
    await prisma.workspace.create({
      data: {
        id,
        name: `Isolation ${name}`,
        slug: `mctb-iso-${name}-${randomUUID().slice(0, 6)}`,
        type: "BUSINESS",
        billingPlan: "trial",
      },
    });
  }

  await prisma.missedCallEvent.create({
    data: {
      id: eventId,
      workspaceId: wsA,
      callerE164: "+15555550111",
      businessE164: "+15555550999",
      reason: "NO_ANSWER",
      traceId: randomUUID(),
      idempotencyKey: `iso-${randomUUID()}`,
      status: "DETECTED",
    },
  });

  try {
    const own = await loadMctbMissedCallDetailPayload(wsA, eventId);
    assert.equal(own.ok, true, "workspace A reads own missed call");

    const cross = await loadMctbMissedCallDetailPayload(wsB, eventId);
    assert.equal(cross.ok, false, "workspace B cannot read A missed call");
    assert.equal(cross.status, 404);

    const link = await createMctbBookingLink(wsA, {
      label: "Test",
      url: "https://example.com/book",
      active: true,
    });

    await expectReject(async () => {
      await updateMctbBookingLink(wsB, link.id, { label: "Hacked" });
    });

    await expectReject(async () => {
      await deleteMctbBookingLink(wsB, link.id);
    });

    await deleteMctbBookingLink(wsA, link.id);
  } finally {
    await prisma.missedCallEvent.deleteMany({ where: { id: eventId } });
    await prisma.mctbBookingLink.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
  }

  console.log("test-mctb-api-workspace-isolation: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
