/**
 * Read-only prod inspection for receptionist agent publish state.
 * Usage: npx tsx scripts/receptionist-inspect-agent-state.ts [agentId]
 */
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";

const AGENT = process.argv[2] || "cmu42zyel1c4x01090c6s335z";

async function main() {
  if (!hydrateProdDatabaseUrlFromCoolify()) throw new Error("no DATABASE_URL");
  hydrateProdSupabaseFromCoolify();
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT },
    select: {
      id: true,
      status: true,
      healthStatus: true,
      healthMessage: true,
      phoneNumberId: true,
      publishedVersionId: true,
      draftConfig: true,
      telnyxAssistantId: true,
      updatedAt: true,
    },
  });
  if (!agent) {
    console.log(JSON.stringify({ error: "not_found", agentId: AGENT }));
    return;
  }
  const wiz = (agent.draftConfig as { advanced?: { appointmentReceptionistWizard?: unknown } })
    ?.advanced?.appointmentReceptionistWizard as Record<string, unknown> | undefined;

  let published: {
    id: string;
    createdAt: Date;
    config: unknown;
  } | null = null;
  if (agent.publishedVersionId) {
    published = await prisma.voiceAgentVersion.findFirst({
      where: { id: agent.publishedVersionId },
      select: { id: true, createdAt: true, config: true },
    });
  }
  const versions = await prisma.voiceAgentVersion.findMany({
    where: { agentId: AGENT },
    orderBy: { publishedAt: "desc" },
    take: 5,
    select: {
      id: true,
      publishedAt: true,
      deploymentStatus: true,
      version: true,
      isMain: true,
    },
  });

  let phone: { e164: string | null; settingsJson: unknown } | null = null;
  if (agent.phoneNumberId) {
    phone = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId },
      select: { e164: true, settingsJson: true },
    });
  }

  const settings = phone?.settingsJson as Record<string, unknown> | null;
  const mctbLocked = Boolean(
    settings?.mctbTexmlLocked ?? settings?.mctb_texml_locked,
  );

  console.log(
    JSON.stringify(
      {
        agent: {
          id: agent.id,
          status: agent.status,
          healthStatus: agent.healthStatus,
          healthMessage: agent.healthMessage,
          phoneNumberId: agent.phoneNumberId,
          phoneE164Last4: phone?.e164?.slice(-4),
          mctbTexmlLocked: mctbLocked,
          publishedVersionId: agent.publishedVersionId,
          telnyxAssistantId: agent.telnyxAssistantId,
          updatedAt: agent.updatedAt,
        },
        wizardDraft: {
          businessName: wiz?.businessName,
          bookingStrategy: wiz?.bookingStrategy,
          configRevision: wiz?.configRevision,
        },
        publishedVersion: published
          ? {
              id: published.id,
              createdAt: published.createdAt,
              wizardBusinessName: (
                published.config as { advanced?: { appointmentReceptionistWizard?: { businessName?: string } } }
              )?.advanced?.appointmentReceptionistWizard?.businessName,
            }
          : null,
        recentVersions: versions,
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
