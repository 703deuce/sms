/**
 * Phase 1b — paid class registration + atomic full-series (requires DATABASE_URL + migration).
 *
 *   npx tsx scripts/cert-advanced-scheduling-phase-1b.ts
 */
import { PrismaClient } from "@prisma/client";

const WORKSPACE_SLUG = process.env.CERT_WORKSPACE_SLUG || "cert-appointments-mctb";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("BLOCKED: DATABASE_URL not set — Phase 1b DB tests not executed");
    process.exit(2);
  }

  const prisma = new PrismaClient();

  const migration = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'service_booking_store_fulfillments'
    ) AS exists
  `;
  if (!migration[0]?.exists) {
    console.error("BLOCKED: service_booking_store_fulfillments missing — run prisma migrate deploy");
    process.exit(2);
  }

  const workspace = await prisma.workspace.findFirst({ where: { slug: WORKSPACE_SLUG } });
  if (!workspace) {
    console.error(`FAIL: workspace ${WORKSPACE_SLUG} not found`);
    process.exit(1);
  }

  const contact = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Cert",
      lastName: "Phase1b",
      phone: `+1555${String(Date.now()).slice(-7)}`,
      status: "SUBSCRIBED",
    },
  });

  const series = await prisma.classSeries.create({
    data: {
      workspaceId: workspace.id,
      name: `Cert course ${Date.now()}`,
      capacity: 10,
      requireFullSeries: true,
      active: true,
      metadata: { kind: "class", isFree: true },
    },
  });

  const occs = await Promise.all(
    [1, 2, 3].map((i) =>
      prisma.classOccurrence.create({
        data: {
          workspaceId: workspace.id,
          seriesId: series.id,
          startsAt: new Date(Date.now() + i * 86_400_000),
          endsAt: new Date(Date.now() + i * 86_400_000 + 3_600_000),
          capacity: 10,
          status: "scheduled",
        },
      }),
    ),
  );

  const { enrollFullSeriesAtomic } = await import(
    "../src/lib/appointments/service-booking/class-registration-capacity"
  );
  const enrollments = await enrollFullSeriesAtomic(workspace.id, {
    contactId: contact.id,
    seriesId: series.id,
  });
  if (enrollments.length !== occs.length) {
    console.error("FAIL: atomic full series count");
    process.exit(1);
  }
  console.log("PASS atomic full-series enrollment");

  const { classDirectEnrollBlockedReason } = await import(
    "../src/lib/appointments/service-booking/class-registration-entitlement"
  );
  const block = classDirectEnrollBlockedReason({
    priceCents: 5000,
    paymentMode: "pay_at_registration",
  });
  if (!block) {
    console.error("FAIL: pay_at_registration should block direct POST");
    process.exit(1);
  }
  console.log("PASS payment bypass guard on direct enroll");

  await prisma.$disconnect();
  console.log("\nCERT PASS — advanced scheduling phase 1b (partial — no live Stripe)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
