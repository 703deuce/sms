/**
 * After prod API walkthrough: verify draft vs published bookingStrategy in DB.
 */
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { loadAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";
import { writeFileSync } from "node:fs";

async function main() {
  const hydrated = hydrateProdTestEnvFromCoolify();
  if (!hydrated.supabase) throw new Error("Supabase hydrate failed");
  const agentId = process.argv[2];
  if (!agentId) throw new Error("Usage: tsx receptionist-trace-prod-db-verify.ts <agentId>");

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId },
    select: {
      workspaceId: true,
      publishedVersionId: true,
      draftConfig: true,
      status: true,
    },
  });
  if (!agent) throw new Error("agent not found");

  const draftWizard = (
    parseVoiceAgentConfig(agent.draftConfig).advanced as Record<string, unknown>
  )?.appointmentReceptionistWizard as { bookingStrategy?: string } | undefined;

  let publishedWizard: { bookingStrategy?: string } | undefined;
  if (agent.publishedVersionId) {
    const ver = await prisma.voiceAgentVersion.findFirst({
      where: { id: agent.publishedVersionId },
      select: { config: true },
    });
    publishedWizard = (
      parseVoiceAgentConfig(ver?.config).advanced as Record<string, unknown>
    )?.appointmentReceptionistWizard as { bookingStrategy?: string } | undefined;
  }

  const loaded = await loadAppointmentReceptionistSetup(agent.workspaceId, { agentId });

  const report = {
    agentId,
    status: agent.status,
    publishedVersionId: agent.publishedVersionId,
    bookingStrategy: {
      loaded_setup: loaded?.state?.bookingStrategy,
      draftConfig_wizard: draftWizard?.bookingStrategy,
      publishedVersion_wizard: publishedWizard?.bookingStrategy,
    },
    draft_equals_send_link: loaded?.state?.bookingStrategy === "SEND_LINK",
    published_unchanged_vs_microsoft:
      publishedWizard?.bookingStrategy === "MICROSOFT_365" ||
      publishedWizard?.bookingStrategy === loaded?.state?.bookingStrategy,
  };

  writeFileSync("/opt/cursor/artifacts/receptionist-prod-db-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
