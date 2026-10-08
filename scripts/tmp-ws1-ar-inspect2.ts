import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
hydrateProdTestEnvFromCoolify();
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const ws = "ws_1";
  const nums = await prisma.phoneNumber.findMany({
    where: {
      OR: [
        { e164: { contains: "571407" } },
        { e164: { contains: "571749" } },
        { e164: { contains: "866602" } },
      ],
    },
    select: { id: true, e164: true, workspaceId: true, platformMctbSender: true, metadata: true },
    take: 20,
  });
  console.log("phone numbers", nums);

  const contacts = await prisma.contact.findMany({
    where: {
      workspaceId: ws,
      OR: [
        { phone: { contains: "5714073615" } },
        { phone: { contains: "5717491060" } },
        { phone: { contains: "571407" } },
      ],
    },
    take: 10,
    select: { id: true, phone: true, firstName: true },
  });
  console.log("contacts", contacts);

  const appts = await prisma.voiceAppointment.findMany({
    where: { workspaceId: ws, externalId: { startsWith: "microsoft:" } },
    orderBy: { startsAt: "desc" },
    take: 5,
    include: { contact: { select: { phone: true } } },
  });
  console.log(
    "microsoft appts",
    appts.map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      status: a.status,
      phone: a.contact?.phone,
      contactId: a.contactId,
      externalId: a.externalId,
    })),
  );

  const msConn = await prisma.calendarConnection.findMany({
    where: { workspaceId: ws, provider: "microsoft" },
    select: { id: true, status: true, accountEmail: true },
  });
  console.log("ms connections", msConn);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
