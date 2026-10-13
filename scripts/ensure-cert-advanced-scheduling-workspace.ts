/**
 * Minimal isolated cert workspace for advanced scheduling DB certs (Prisma only).
 *
 *   DATABASE_URL=... npx tsx scripts/ensure-cert-advanced-scheduling-workspace.ts
 */
import { PrismaClient } from "@prisma/client";

const SLUG = process.env.CERT_WORKSPACE_SLUG || "cert-appointments-mctb";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(2);
  }
  const prisma = new PrismaClient();
  const existing = await prisma.workspace.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`OK workspace exists: ${SLUG} (${existing.id})`);
    await prisma.$disconnect();
    return;
  }

  const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!owner) {
    console.error("FAIL: no user in database to own cert workspace");
    process.exit(1);
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: "Advanced Scheduling Cert",
      slug: SLUG,
      type: "BUSINESS",
      ownerUserId: owner.id,
      billingPlan: "trial",
      creditBalanceCents: 0,
      memberships: { create: { userId: owner.id, role: "OWNER" } },
      messagingRegistration: { create: {} },
      workspaceLimits: {
        create: {
          limits: { dailyCap: 500, maxNumbers: 5, trialDays: 14, requireCard: false },
        },
      },
    },
  });

  console.log(`CREATED workspace ${SLUG} (${workspace.id})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
