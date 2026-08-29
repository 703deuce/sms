import { getPrisma } from "../src/lib/db";
import { resolveInboundAiAgent } from "../src/lib/voice/agent-phone";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";

async function main() {
  const prisma = getPrisma();
  const phoneId = "cmsgtjms84g6l2h0o255w1e3v";
  const ws = "ws_1";
  const phone = await prisma.phoneNumber.findFirst({ where: { e164: "+15714073615" } });
  console.log("phone lookup", phone?.id, phone?.status, phone?.e164);
  const agent = await resolveInboundAiAgent(ws, phoneId);
  console.log("resolveInboundAiAgent", agent?.id, agent?.name, agent?.status);
  const route = await resolveAgentByCalledNumber("+15714073615");
  console.log("resolveAgentByCalledNumber", route);
  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: "cmsdkcnwr5p3i5s0h3i1x0j60" },
    select: { id: true, status: true, phoneNumberId: true },
  });
  console.log("agentRow", agentRow);
}

main();
