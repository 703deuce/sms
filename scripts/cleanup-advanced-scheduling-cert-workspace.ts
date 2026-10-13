/**
 * Remove disposable advanced-scheduling certification workspace and children.
 *
 *   AR_CERT_ALLOW_PRODUCTION_DB=1 DATABASE_URL=... npx tsx scripts/cleanup-advanced-scheduling-cert-workspace.ts
 */
import { PrismaClient } from "@prisma/client";
import { applyCertDatabaseEnv } from "./lib/cert-database-url";

const SLUG = process.env.CERT_WORKSPACE_SLUG || "cert-appointments-mctb";

async function main() {
  const env = applyCertDatabaseEnv();
  if (!env.ok) {
    console.error(env.message);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const workspace = await prisma.workspace.findUnique({ where: { slug: SLUG } });
  if (!workspace) {
    console.log(`OK — no workspace ${SLUG}`);
    await prisma.$disconnect();
    return;
  }

  const wid = workspace.id;
  await prisma.classOccurrenceRegistrationHold.deleteMany({ where: { workspaceId: wid } });
  await prisma.serviceBookingStoreFulfillment.deleteMany({ where: { workspaceId: wid } });
  await prisma.classEnrollment.deleteMany({ where: { workspaceId: wid } });
  await prisma.classOccurrence.deleteMany({ where: { workspaceId: wid } });
  await prisma.classSeries.deleteMany({ where: { workspaceId: wid } });
  await prisma.packageLedgerEntry.deleteMany({
    where: { balance: { workspaceId: wid } },
  });
  await prisma.packageBalance.deleteMany({ where: { workspaceId: wid } });
  await prisma.packageProduct.deleteMany({ where: { workspaceId: wid } });
  await prisma.contact.deleteMany({ where: { workspaceId: wid } });
  await prisma.membership.deleteMany({ where: { workspaceId: wid } });
  await prisma.workspaceLimits.deleteMany({ where: { workspaceId: wid } }).catch(() => {});
  await prisma.messagingRegistration.deleteMany({ where: { workspaceId: wid } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: wid } });

  console.log(`DELETED cert workspace ${SLUG} (${wid})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
