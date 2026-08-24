import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: "+18663221763" },
    select: { id: true, e164: true, workspaceId: true, settingsJson: true, providerNumberId: true },
  });
  console.log(JSON.stringify(pn, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
