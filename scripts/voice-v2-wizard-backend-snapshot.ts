#!/usr/bin/env npx tsx
/**
 * Read-only backend snapshot for wizard UI certification (stdout JSON).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-v2-wizard-backend-snapshot.ts <agentId>
 */
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import { resolveVoiceV2BookingStrategy } from "../src/lib/voice-v2/booking-strategy";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-v2/intake/compile-schema";

async function main() {
  const agentId = process.argv[2] || process.env.AGENT_ID || "";
  if (!agentId) {
    console.log(JSON.stringify({ error: "agentId required" }));
    process.exit(1);
  }
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      status: true,
      phoneNumberId: true,
      publishedVersionId: true,
      draftConfig: true,
      workspaceId: true,
    },
  });
  if (!agent) {
    console.log(JSON.stringify({ error: "agent not found" }));
    process.exit(1);
  }
  const draft = parseVoiceAgentConfig(agent.draftConfig);
  const advanced = (draft.advanced || {}) as Record<string, unknown>;
  const published = agent.publishedVersionId
    ? await prisma.voiceAgentVersion.findFirst({
        where: { id: agent.publishedVersionId },
        select: { id: true, config: true, createdAt: true },
      })
    : null;
  const pubCfg = published?.config ? parseVoiceAgentConfig(published.config) : null;
  const pubAdv = (pubCfg?.advanced || {}) as Record<string, unknown>;

  const setup = await loadAppointmentReceptionistSetup(agent.workspaceId, { agentId });
  const intake = compileVoiceV2IntakeSchema(draft);
  const fieldIds = Object.keys(intake.fields || {});

  let phoneLast4: string | null = null;
  if (agent.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId },
      select: { e164: true, settingsJson: true },
    });
    if (pn?.e164) phoneLast4 = pn.e164.slice(-4);
  }

  const out = {
    agentId: agent.id,
    agentName: agent.name,
    status: agent.status,
    workspaceId: agent.workspaceId,
    draftBookingStrategy:
      (advanced.bookingStrategy as string) ||
      setup?.state?.bookingStrategy ||
      null,
    publishedBookingStrategy: (pubAdv.bookingStrategy as string) || null,
    draftStrategyResolved: resolveVoiceV2BookingStrategy(draft),
    publishedStrategyResolved: pubCfg ? resolveVoiceV2BookingStrategy(pubCfg) : null,
    publishedVersionId: agent.publishedVersionId,
    publishedVersionCreatedAt: published?.createdAt?.toISOString() || null,
    phoneLast4,
    collectFieldCount: setup?.state?.collectFields?.length ?? 0,
    collectFieldLabels: (setup?.state?.collectFields || []).map((f) => f.label),
    compiledIntakeFieldIds: fieldIds,
    qualificationEnabled: Boolean(
      (advanced.qualification as { qualificationEnabled?: boolean } | undefined)
        ?.qualificationEnabled,
    ),
    knowledgeBaseEnabled: Boolean(
      (advanced.knowledge as { knowledgeBaseEnabled?: boolean } | undefined)
        ?.knowledgeBaseEnabled,
    ),
  };
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
