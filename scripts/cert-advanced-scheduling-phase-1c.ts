/**
 * Phase 1c — durable fulfillment, atomic redeem, capacity + holds (requires DATABASE_URL).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/cert-advanced-scheduling-phase-1c.ts
 *
 * Also requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (production Supabase compat).
 */
import { PrismaClient } from "@prisma/client";
import { creditKeyForBookingType } from "../src/lib/appointments/service-booking/package-credit-keys";
import { applyCertDatabaseEnv } from "./lib/cert-database-url";

const WORKSPACE_SLUG = process.env.CERT_WORKSPACE_SLUG || "cert-ar-isolated";

async function main() {
  const env = applyCertDatabaseEnv();
  if (!env.ok) {
    console.error("BLOCKED:", env.message);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const workspace = await prisma.workspace.findFirst({ where: { slug: WORKSPACE_SLUG } });
  if (!workspace) {
    console.error(`FAIL: workspace ${WORKSPACE_SLUG} not found`);
    process.exit(1);
  }

  const contact = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Cert",
      lastName: "Phase1c",
      phone: `+1555${String(Date.now()).slice(-7)}`,
      status: "SUBSCRIBED",
      consentSource: "cert",
      consentDate: new Date(),
    },
  });

  // --- Store fulfillment idempotency ---
  const sessionId = `cs_cert_${Date.now()}`;
  const product = await prisma.packageProduct.create({
    data: {
      workspaceId: workspace.id,
      name: `Cert pkg ${Date.now()}`,
      slug: `cert-pkg-1c-${Date.now()}`,
      priceCents: 5000,
      creditRules: [{ quantity: 2, label: "2 sessions" }],
      active: true,
    },
  });

  const { fulfillStoreCheckoutSessionOnce } = await import(
    "../src/lib/appointments/service-booking/store-fulfillment"
  );

  const meta = {
    transaction_type: "service_booking_store_purchase",
    workspaceId: workspace.id,
    kind: "package",
    productId: product.id,
    contactId: contact.id,
    amountCents: "5000",
  };

  const first = await fulfillStoreCheckoutSessionOnce({ id: sessionId, metadata: meta });
  const second = await fulfillStoreCheckoutSessionOnce({ id: sessionId, metadata: meta });

  if (!first.handled || !("result" in first)) {
    console.error("FAIL: first fulfillment", first);
    process.exit(1);
  }
  if (!second.duplicate) {
    console.error("FAIL: expected duplicate on webhook replay");
    process.exit(1);
  }
  const balanceCount = await prisma.packageBalance.count({
    where: { workspaceId: workspace.id, productId: product.id, contactId: contact.id },
  });
  if (balanceCount !== 1) {
    console.error(`FAIL: expected 1 balance, got ${balanceCount}`);
    process.exit(1);
  }
  console.log("PASS store fulfillment idempotency");

  // --- Atomic redeem race ---
  const balance = await prisma.packageBalance.findFirst({
    where: { workspaceId: workspace.id, contactId: contact.id, productId: product.id },
  });
  if (!balance) {
    console.error("FAIL: no balance");
    process.exit(1);
  }
  await prisma.packageBalance.update({
    where: { id: balance.id },
    data: { remainingCredits: { [creditKeyForBookingType("x")]: 1, default: 0 } },
  });

  const { redeemPackageCreditAtomic } = await import(
    "../src/lib/appointments/service-booking/package-credit-redeem"
  );
  const refA = `enroll-a-${Date.now()}`;
  const refB = `enroll-b-${Date.now()}`;
  const results = await Promise.allSettled([
    redeemPackageCreditAtomic(balance.id, "class", refA, creditKeyForBookingType("x")),
    redeemPackageCreditAtomic(balance.id, "class", refB, creditKeyForBookingType("x")),
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    console.error("FAIL: concurrent redeem expected 1 success 1 failure", results);
    process.exit(1);
  }
  console.log("PASS concurrent package redeem");

  // --- Last seat + hold ---
  const series = await prisma.classSeries.create({
    data: {
      workspaceId: workspace.id,
      name: `Cert class ${Date.now()}`,
      capacity: 1,
      active: true,
      metadata: { kind: "class", isFree: true },
    },
  });
  const occ = await prisma.classOccurrence.create({
    data: {
      workspaceId: workspace.id,
      seriesId: series.id,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000 + 3_600_000),
      capacity: 1,
      status: "scheduled",
    },
  });

  const {
    createClassRegistrationHold,
    enrollInOccurrenceWithCapacityLock,
    expireStaleClassRegistrationHolds,
    recordClassCheckoutFulfillmentFailure,
  } = await import("../src/lib/appointments/service-booking/class-registration-capacity");

  const hold = await createClassRegistrationHold({
    workspaceId: workspace.id,
    occurrenceId: occ.id,
    contactId: contact.id,
    holdMinutes: 1,
  });

  const contact2 = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Cert2",
      lastName: "Phase1c",
      phone: `+1555${String(Date.now() + 1).slice(-7)}`,
      status: "SUBSCRIBED",
    },
  });

  let blocked = false;
  try {
    await enrollInOccurrenceWithCapacityLock(workspace.id, {
      occurrenceId: occ.id,
      seriesId: series.id,
      contactId: contact2.id,
    });
  } catch {
    blocked = true;
  }
  if (!blocked) {
    console.error("FAIL: hold should block last seat");
    process.exit(1);
  }
  console.log("PASS active hold blocks enrollment");

  await prisma.classOccurrenceRegistrationHold.update({
    where: { id: hold.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  await expireStaleClassRegistrationHolds(workspace.id);

  await enrollInOccurrenceWithCapacityLock(workspace.id, {
    occurrenceId: occ.id,
    seriesId: series.id,
    contactId: contact2.id,
  });
  console.log("PASS expired hold releases capacity");

  const recovery = await recordClassCheckoutFulfillmentFailure({
    holdId: hold.id,
    reason: "cert simulated full after pay",
    recovery: "refund_pending",
  });
  if (!recovery || recovery.fulfillmentOutcome !== "refund_pending") {
    console.error("FAIL: fulfillment recovery record");
    process.exit(1);
  }
  console.log("PASS fulfillment recovery metadata (no refund executed)");

  console.log("\nCERT PASS — advanced scheduling phase 1c");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
