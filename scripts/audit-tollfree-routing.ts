import { getPrisma } from "../src/lib/db";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";

const E164S = ["+18663464256", "+18665779653", "+15714073615"];

async function main() {
  const prisma = getPrisma();
  for (const e164 of E164S) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { e164 },
      select: {
        id: true,
        e164: true,
        workspaceId: true,
        status: true,
        settingsJson: true,
        capabilitiesJson: true,
      },
    });
    if (!phone) {
      console.log(e164, "NOT IN DB");
      continue;
    }
    const caps = readPhoneCapabilities(phone);
    const tel = ((phone.settingsJson || {}) as Record<string, unknown>).telephony as
      | Record<string, unknown>
      | undefined;
    const route = await resolveAgentByCalledNumber(e164).catch(() => null);
    const joins = await prisma.voiceAgentPhoneNumber.findMany({
      where: { phoneNumberId: phone.id },
      select: { agentId: true, inboundEnabled: true, workspaceId: true },
    });
    console.log("\n", e164);
    console.log("  id", phone.id, "ws", phone.workspaceId, "status", phone.status);
    console.log("  caps", caps);
    console.log("  routingMode", tel?.routingMode);
    console.log("  livekitInboundTrunkId", tel?.livekitInboundTrunkId);
    console.log("  livekitDidDispatchRuleId", tel?.livekitDidDispatchRuleId);
    console.log("  joins", joins);
    console.log(
      "  aiRoute",
      route ? { agentId: route.agentId, name: route.agentName, ws: route.workspaceId } : null,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
