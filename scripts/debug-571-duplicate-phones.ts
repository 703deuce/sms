import { getPrisma } from "../src/lib/db";
import { resolveInboundAiAgent } from "../src/lib/voice/agent-phone";

async function main() {
  const prisma = getPrisma();
  const rows = await prisma.phoneNumber.findMany({
    where: { e164: "+15714073615" },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      settingsJson: true,
    },
  });
  for (const row of rows) {
    const agent = await resolveInboundAiAgent(row.workspaceId, row.id);
    console.log({
      id: row.id,
      workspaceId: row.workspaceId,
      status: row.status,
      routingMode: (row.settingsJson as Record<string, unknown>)?.telephony,
      agent: agent ? { id: agent.id, name: agent.name } : null,
    });
  }
}

main();
