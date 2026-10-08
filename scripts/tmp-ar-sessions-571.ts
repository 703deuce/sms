import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
hydrateProdTestEnvFromCoolify();
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const consumer = "+15714073615";
  const ar = await prisma.arSmsReplySession.findMany({
    where: { consumerE164: { contains: "5714073615" } },
    orderBy: { lastUsedAt: "desc" },
    take: 5,
    select: {
      id: true,
      lifecycleState: true,
      appointmentId: true,
      platformPhoneNumberId: true,
      lastUsedAt: true,
    },
  });
  console.log("ar sessions", ar);
  const mctb = await prisma.platformSenderAssignment.findMany({
    where: { consumerE164: { contains: "5714073615" } },
    take: 5,
  });
  console.log("mctb assignments", mctb.length);
}
main();
