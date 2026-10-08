import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
hydrateProdTestEnvFromCoolify();
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const rows = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: "ws_1" },
    select: { id: true, provider: true, status: true, accountEmail: true },
  });
  console.log(rows);
  const c = await prisma.contact.findFirst({
    where: { workspaceId: "ws_1", phone: "+15714073615" },
  });
  console.log("contact 73615", c?.id);
}
main();
