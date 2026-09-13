#!/usr/bin/env tsx
/**
 * Shows which UI path owns each ACTIVE voice agent (appointment wizard vs generic /voice/agents).
 * Usage: npx tsx scripts/inspect-voice-agent-wizard-path.ts [workspaceId]
 */
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

async function main() {
  const workspaceId = process.argv[2] || process.env.WORKSPACE_ID || "ws_1";
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      agentType: true,
      purpose: true,
      telnyxAssistantId: true,
      phoneNumberId: true,
      publishedVersionId: true,
      sourceSolutionSetupId: true,
      draftConfig: true,
      phoneAssignments: {
        select: { phoneNumberId: true, inboundEnabled: true },
      },
    },
  });

  console.log(`Workspace ${workspaceId}: ${agents.length} voice agent(s)\n`);

  for (const a of agents) {
    const cfg = parseVoiceAgentConfig(a.draftConfig);
    const adv = (cfg.advanced || {}) as Record<string, unknown>;
    const hasAppt = Boolean(adv.appointmentReceptionistWizard);
    const hasRecv = Boolean(adv.receptionistWizard);
    const pack = adv.capabilityPack;
    const arch = adv.voiceArchitectureVersion;
    const path = hasAppt || pack === "appointment_receptionist" || a.purpose === "appointment_receptionist"
      ? "APPOINTMENT_WIZARD (8-step /solutions/.../setup)"
      : hasRecv
        ? "GENERIC_VOICE_AGENTS (/voice/agents editor)"
        : "UNKNOWN — inspect draft manually";

    const editUrl = hasAppt || a.sourceSolutionSetupId
      ? `/solutions/ai-call-handling/appointment-assistant/setup?agentId=${a.id}`
      : `/voice/agents/${a.id}/about`;

    console.log("—".repeat(60));
    console.log(`Name: ${a.name}`);
    console.log(`ID: ${a.id}`);
    console.log(`Status: ${a.status} | Telnyx assistant: ${a.telnyxAssistantId || "—"}`);
    console.log(`agentType: ${a.agentType} | purpose: ${a.purpose || "—"}`);
    console.log(`Wizard path: ${path}`);
    console.log(`Markers: apptWizard=${hasAppt} recvWizard=${hasRecv} pack=${pack || "—"} arch=${arch || "—"}`);
    console.log(`sourceSolutionSetupId: ${a.sourceSolutionSetupId || "—"}`);
    console.log(`published: ${a.publishedVersionId ? "yes" : "no"}`);
    console.log(`Edit here: ${editUrl}`);
    const assignments = a.phoneAssignments || [];
    if (assignments.length) {
      console.log(
        `Phone assignments: ${assignments.map((p) => `${p.phoneNumberId}${p.inboundEnabled ? " (inbound)" : ""}`).join(", ")}`,
      );
    }
    if (a.phoneNumberId) console.log(`phoneNumberId (legacy): ${a.phoneNumberId}`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
