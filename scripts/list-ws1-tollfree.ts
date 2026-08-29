import { getPrisma } from "../src/lib/db";

const WS = process.env.WORKSPACE_ID || "ws_1";
const TOLL_FREE_NPAS = ["800", "833", "844", "855", "866", "877", "888"];

async function main() {
  const prisma = getPrisma();
  const wsNumbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: WS },
    select: { id: true, e164: true, status: true },
    orderBy: { e164: "asc" },
  });
  console.log(`\n=== ${WS} numbers (${wsNumbers.length}) ===`);
  for (const n of wsNumbers) {
    const npa = n.e164.replace(/\D/g, "").slice(1, 4);
    const kind = TOLL_FREE_NPAS.includes(npa) ? "toll-free" : "local";
    console.log(`${n.e164}  ${n.status}  ${kind}  ${n.id}`);
  }

  const tollFree = await prisma.phoneNumber.findMany({
    where: {
      OR: TOLL_FREE_NPAS.map((npa) => ({ e164: { contains: `+1${npa}` } })),
    },
    select: { id: true, e164: true, status: true, workspaceId: true },
    orderBy: { e164: "asc" },
  });
  console.log(`\n=== All toll-free in DB (${tollFree.length}) ===`);
  for (const n of tollFree) {
    console.log(`${n.e164}  ws=${n.workspaceId}  ${n.status}  ${n.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
