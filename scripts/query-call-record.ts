import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: "b7bebb5c-40ca-482c-85b4-6c4f75cb4e24" },
    select: { id: true, fromE164: true, toE164: true, status: true, metadata: true, durationSeconds: true },
  });
  console.log(JSON.stringify(call, null, 2));
}

main();
