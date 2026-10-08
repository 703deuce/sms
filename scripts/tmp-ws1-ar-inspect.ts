import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
hydrateProdTestEnvFromCoolify();
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const ws = "ws_1";
  const phones = ["+15714073615", "+15717491060"];
  for (const p of phones) {
    const c = await prisma.contact.findFirst({
      where: { workspaceId: ws, OR: [{ phone: p }, { phone: { contains: "571407" } }] },
      select: { id: true, phone: true, firstName: true },
    });
    console.log("contact", p, c);
  }
  const appts = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: ws,
      status: { in: ["confirmed", "scheduled"] },
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: 8,
    include: { contact: { select: { phone: true, firstName: true } } },
  });
  console.log(
    "upcoming appts",
    appts.map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      phone: a.contact?.phone,
      externalId: a.externalId?.slice(0, 60),
      status: a.status,
    })),
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
