import { getPrisma } from "../src/lib/db";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";

const WS = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: WS },
    select: { id: true, name: true },
  });
  console.log("workspace", ws);

  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: WS },
    select: {
      id: true,
      e164: true,
      status: true,
      settingsJson: true,
      capabilitiesJson: true,
      provider: true,
    },
  });

  for (const n of numbers) {
    const caps = readPhoneCapabilities({
      settingsJson: n.settingsJson,
      capabilitiesJson: n.capabilitiesJson,
    });
    const settings = (n.settingsJson || {}) as Record<string, unknown>;
    const tel = ((settings.telephony || settings.provisioning) || {}) as Record<string, unknown>;
    console.log("---", n.e164, n.id, n.status);
    console.log("  caps", caps);
    console.log(
      "  routingMode",
      tel.routingMode,
      "routingOwner",
      settings.routingOwner,
      "callHandlingMode",
      settings.callHandlingMode,
    );
    const route = await resolveAgentByCalledNumber(n.e164).catch(() => null);
    console.log(
      "  aiRoute",
      route
        ? { agentId: route.agentId, name: route.agentName, status: route.agentStatus }
        : null,
    );
  }

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: WS },
    select: { id: true, name: true, status: true, phoneNumberId: true, displayName: true },
    orderBy: { updatedAt: "desc" },
  });
  console.log("agents", agents);

  const joins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: WS },
    select: { agentId: true, phoneNumberId: true, inboundEnabled: true },
  });
  console.log("joins", joins);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
