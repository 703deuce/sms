import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";

async function main() {
  if (!hydrateProdDatabaseUrlFromCoolify()) throw new Error("no db");
  hydrateProdSupabaseFromCoolify();
  const rows = await getPrisma().voiceAgent.findMany({
    where: { archivedAt: null, purpose: "appointment_receptionist", status: "DRAFT" },
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: { id: true, workspaceId: true, name: true, status: true },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main();
