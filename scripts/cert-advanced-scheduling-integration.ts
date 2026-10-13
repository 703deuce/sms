/**
 * Advanced scheduling integration cert — isolated database required.
 *
 *   export AR_CERT_DATABASE_URL=postgresql://ar_cert:ar_cert_local_only@127.0.0.1:5432/transovo_ar_cert
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/cert-advanced-scheduling-integration.ts
 */
import { PrismaClient } from "@prisma/client";
import { applyCertDatabaseEnv } from "./lib/cert-database-url";

const WORKSPACE_SLUG = process.env.CERT_WORKSPACE_SLUG || "cert-ar-isolated";

async function ensureWorkspace(prisma: PrismaClient) {
  let workspace = await prisma.workspace.findUnique({ where: { slug: WORKSPACE_SLUG } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "AR Cert Isolated",
        slug: WORKSPACE_SLUG,
        type: "BUSINESS",
        billingPlan: "trial",
        creditBalanceCents: 0,
        messagingRegistration: { create: {} },
        workspaceLimits: { create: { limits: {} } },
      },
    });
  }
  return workspace;
}

async function main() {
  const env = applyCertDatabaseEnv();
  if (!env.ok) {
    console.error("BLOCKED:", env.message);
    process.exit(2);
  }
  console.log(`Cert database: ${env.isolated ? "isolated" : "shared"}`);

  const prisma = new PrismaClient();
  const workspace = await ensureWorkspace(prisma);

  // --- Concurrent last seat ---
  const contactA = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Race",
      lastName: "A",
      phone: `+1555${String(Date.now()).slice(-7)}`,
      status: "SUBSCRIBED",
    },
  });
  const contactB = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Race",
      lastName: "B",
      phone: `+1555${String(Date.now() + 1).slice(-7)}`,
      status: "SUBSCRIBED",
    },
  });
  const series = await prisma.classSeries.create({
    data: {
      workspaceId: workspace.id,
      name: `Race ${Date.now()}`,
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

  const { enrollInOccurrenceWithCapacityLock } = await import(
    "../src/lib/appointments/service-booking/class-registration-capacity"
  );

  const results = await Promise.allSettled([
    enrollInOccurrenceWithCapacityLock(workspace.id, {
      occurrenceId: occ.id,
      seriesId: series.id,
      contactId: contactA.id,
    }),
    enrollInOccurrenceWithCapacityLock(workspace.id, {
      occurrenceId: occ.id,
      seriesId: series.id,
      contactId: contactB.id,
    }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.filter((r) => r.status === "rejected").length;
  if (ok !== 1 || fail !== 1) {
    console.error("FAIL concurrent last seat", { ok, fail, results });
    process.exit(1);
  }
  console.log("PASS concurrent last-seat enrollment");

  // --- Duplicate fulfillment claim (Prisma idempotency row) ---
  const sessionId = `cs_int_${Date.now()}`;
  const claim1 = await prisma.serviceBookingStoreFulfillment.create({
    data: {
      workspaceId: workspace.id,
      stripeSessionId: sessionId,
      transactionType: "service_booking_class_registration",
      status: "fulfilled",
      resultJson: { test: true },
    },
  });
  let duplicate = false;
  try {
    await prisma.serviceBookingStoreFulfillment.create({
      data: {
        workspaceId: workspace.id,
        stripeSessionId: sessionId,
        transactionType: "service_booking_class_registration",
        status: "processing",
      },
    });
  } catch {
    duplicate = true;
  }
  if (!claim1.id || !duplicate) {
    console.error("FAIL duplicate fulfillment row constraint");
    process.exit(1);
  }
  console.log("PASS duplicate fulfillment session idempotency");

  await prisma.$disconnect();
  console.log("\nCERT PASS — advanced scheduling integration (isolated DB)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
