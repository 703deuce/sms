import { getPrisma } from "@/lib/db";

async function main() {
  const rows = await getPrisma().workspace.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main();
