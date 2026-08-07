#!/usr/bin/env node
/**
 * Live routing split:
 *   +18663464256 (866 toll-free) → Amy AI answers
 *   +15714073615 (571 local)     → John missed-call text-back (ring, no AI)
 *
 *   npx tsx scripts/setup-amy-866-john-571.mjs
 */
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();
const PHONE_571_ID = (process.env.PHONE_571_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const { activateJohnOnPhoneNumber } = await import(
    "../src/lib/agents/missed-call-text-back/phone-switch.ts"
  );
  const { updateVoiceAgentDraft, publishVoiceAgent } = await import(
    "../src/lib/voice/agent-service.ts"
  );
  const { getPhoneNumberAiOwner } = await import("../src/lib/voice/agent-phone.ts");

  const pn866 = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
  const pn571 = await prisma.phoneNumber.findUnique({ where: { id: PHONE_571_ID } });
  const amy = await prisma.voiceAgent.findUnique({ where: { id: AMY_AGENT_ID } });
  if (!pn866 || !pn571) throw new Error("Phone numbers not found");
  if (!amy) throw new Error(`Amy agent ${AMY_AGENT_ID} not found`);

  console.log("\n=== 1) Keep John on 571 ===");
  const john = await activateJohnOnPhoneNumber({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_571_ID,
    smsPhoneNumberId: PHONE_571_ID,
    delaySeconds: 0,
  });
  console.log({ call: pn571.e164, john: john.ok });

  console.log("\n=== 2) Assign Amy to 866 ===");
  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, {
    phoneNumberId: PHONE_866_ID,
    status: "ACTIVE",
  });

  console.log("\n=== 3) Publish Amy → Telnyx TeXML on 866 ===");
  const published = await publishVoiceAgent(WORKSPACE_ID, AMY_AGENT_ID, "setup-script");
  console.log({
    agent: published.agent.name,
    telnyxAssistantId: published.agent.telnyxAssistantId,
    phoneNumberId: published.agent.phoneNumberId,
    texmlRoute: published.texmlRoute,
  });

  const owner866 = await getPhoneNumberAiOwner(WORKSPACE_ID, PHONE_866_ID);
  const owner571 = await getPhoneNumberAiOwner(WORKSPACE_ID, PHONE_571_ID);
  const mctb = await prisma.missedCallTextConfig.findFirst({
    where: { workspaceId: WORKSPACE_ID },
  });

  console.log("\n=== READY ===");
  console.log(
    JSON.stringify(
      {
        amy: {
          call: pn866.e164,
          agentId: AMY_AGENT_ID,
          owner: owner866,
          expect: "AI answers when you call",
        },
        john: {
          call: pn571.e164,
          mctbPhoneNumberId: mctb?.phoneNumberId,
          mctbEnabled: mctb?.enabled,
          owner571,
          expect: "Rings without AI; texts back from 571 after missed call",
        },
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
