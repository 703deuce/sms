import { requireIsolatedArTestDatabase } from "./cloud-agent/ar-test-database-guard";
import { getPrisma } from "@/lib/db";

async function main() {
  requireIsolatedArTestDatabase();
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      startsAt: { gt: new Date() },
      status: { notIn: ["canceled", "cancelled", "completed"] },
      externalId: { startsWith: "microsoft:" },
      contactId: { not: null },
    },
    orderBy: { startsAt: "asc" },
    take: 8,
    include: { contact: { select: { phone: true } } },
  });
  for (const r of rows) {
    if (!r.contact?.phone) continue;
    console.log(
      JSON.stringify({
        workspaceId: r.workspaceId,
        appointmentId: r.id,
        startsAt: r.startsAt.toISOString(),
        externalId: r.externalId,
      }),
    );
  }
  if (!rows.length) {
    const fallback = await prisma.voiceAppointment.findMany({
      where: {
        startsAt: { gt: new Date() },
        status: { notIn: ["canceled", "cancelled", "completed"] },
        contactId: { not: null },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { contact: { select: { phone: true } } },
    });
    console.log("# fallback (any provider):");
    for (const r of fallback) {
      if (!r.contact?.phone) continue;
      console.log(
        JSON.stringify({
          workspaceId: r.workspaceId,
          appointmentId: r.id,
          startsAt: r.startsAt.toISOString(),
          externalId: r.externalId,
        }),
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
