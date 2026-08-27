import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const ws = "ws_1";
  const active = await prisma.automationFlow.count({
    where: { workspaceId: ws, status: "ACTIVE" },
  });
  const cert = await prisma.automationFlow.count({
    where: { workspaceId: ws, name: { startsWith: "cert-" } },
  });
  const nonCert = active - cert;
  console.log({ active, cert, nonCert });
}

main().catch(console.error);
