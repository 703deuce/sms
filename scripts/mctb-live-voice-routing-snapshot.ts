#!/usr/bin/env npx tsx
import { getPrisma } from "@/lib/db";
import { getPhoneNumberAiOwner } from "@/lib/voice/agent-phone";

const WS = process.env.WORKSPACE_ID || "ws_1";
const IDS = [
  "cmsgtjms84g6l2h0o255w1e3v",
  "cmsc3numa1j17084g391t2z5l",
  "cmttfl9ur1a6v6s294k724k5a",
];

async function main() {
  const prisma = getPrisma();
  for (const id of IDS) {
    const pn = await prisma.phoneNumber.findUnique({ where: { id }, select: { e164: true } });
    const owner = await getPhoneNumberAiOwner(WS, id);
    const agents = await prisma.voiceAgent.findMany({
      where: { workspaceId: WS, phoneNumberId: id },
      select: { id: true, name: true, status: true },
    });
    console.log(pn?.e164, { owner, agents });
  }
}

main();
