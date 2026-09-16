#!/usr/bin/env npx tsx
/** Read-only: wizard agent + MCTB line + trigger deployment for inbound debugging. */
import { getPrisma } from "../src/lib/db";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import { getVoiceAgentReadiness } from "../src/lib/mctb/inbound-handling/voice-readiness";

async function main() {
  const agentId = process.argv[2] || process.env.AGENT_ID || "";
  const workspaceId = process.env.WORKSPACE_ID || "ws_1";
  if (!agentId) {
    console.error("usage: inspect-wizard-voice-line.ts <agentId>");
    process.exit(1);
  }
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: {
      id: true,
      name: true,
      status: true,
      phoneNumberId: true,
      telnyxAssistantId: true,
      publishedVersionId: true,
      primaryFlowId: true,
    },
  });
  if (!agent) {
    console.log(JSON.stringify({ error: "agent_not_found" }));
    process.exit(1);
  }
  const setup = await loadAppointmentReceptionistSetup(workspaceId, { agentId });
  const phone = agent.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: agent.phoneNumberId, workspaceId },
        select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
      })
    : null;
  const inbound =
    phone?.settingsJson &&
    typeof phone.settingsJson === "object" &&
    !Array.isArray(phone.settingsJson)
      ? (phone.settingsJson as Record<string, unknown>).mctbInbound
      : null;
  const triggers = await prisma.triggerDeployment.findMany({
    where: { workspaceId, phoneNumberId: agent.phoneNumberId || undefined },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      flowId: true,
      phoneNumberId: true,
      providerConfig: true,
      updatedAt: true,
    },
  });
  const readiness = await getVoiceAgentReadiness({
    workspaceId,
    agentId,
    phoneNumberId: agent.phoneNumberId,
  });
  console.log(
    JSON.stringify(
      {
        agent,
        wizardPhoneNumberId: setup?.state?.phoneNumberId ?? null,
        wizardPhoneE164: setup?.state?.phoneNumberE164 ?? null,
        phone: phone
          ? { e164: phone.e164, providerNumberId: phone.providerNumberId, mctbInbound: inbound }
          : null,
        triggers,
        readiness,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
