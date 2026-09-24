import { deployRealtorSpeedToLead } from "@/lib/realtor/deploy-speed-to-lead";
import { getPrisma } from "@/lib/db";
import { loadRealtorProductConfig, saveRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "@/lib/realtor/types";
import { compileRealtorAgents } from "@/lib/voice/real-estate/compile";
import { ensureRealEstateFrontDeskAgent } from "./deploy-agent";
import { seedRealEstateFrontDeskKnowledge } from "./deploy-knowledge";
import { publishVoiceAgentVersion } from "./publish";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

declare global {
  // eslint-disable-next-line no-var
  var __transovoRealEstateFrontDeskBootstrapped: boolean | undefined;
}

export function isRealEstateAutoDeployEnabled(): boolean {
  const explicit = process.env.REAL_ESTATE_AUTO_DEPLOY?.trim();
  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;
  return process.env.FRONTDESK_REALTIME_TEST?.trim() === "1";
}

function bootstrapProductConfig(
  existing: Awaited<ReturnType<typeof loadRealtorProductConfig>>,
): Awaited<ReturnType<typeof loadRealtorProductConfig>> {
  const teamName =
    existing.business.teamName?.trim() ||
    process.env.RE_BUSINESS_NAME?.trim() ||
    process.env.RE_TEAM_NAME?.trim();
  return {
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    ...existing,
    enabled: true,
    business: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.business,
      ...existing.business,
      teamName: teamName || existing.business.teamName,
      serviceAreas:
        existing.business.serviceAreas?.length
          ? existing.business.serviceAreas
          : process.env.RE_SERVICE_AREAS?.split(",").map((s) => s.trim()).filter(Boolean) ||
            DEFAULT_REALTOR_PRODUCT_CONFIG.business.serviceAreas,
    },
    identity: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.identity,
      ...existing.identity,
      agentName: existing.identity?.agentName || process.env.RE_AGENT_NAME?.trim() || "Amy",
    },
  };
}

export type BootstrapRealEstateFrontDeskResult = {
  agent?: Awaited<ReturnType<typeof ensureRealEstateFrontDeskAgent>>;
  knowledge?: Awaited<ReturnType<typeof seedRealEstateFrontDeskKnowledge>>;
};

/**
 * On server/voice-runtime boot: ensure RE front desk agent + knowledge without manual scripts.
 */
export async function bootstrapRealEstateFrontDesk(): Promise<BootstrapRealEstateFrontDeskResult | null> {
  if (!isRealEstateAutoDeployEnabled()) return null;
  if (globalThis.__transovoRealEstateFrontDeskBootstrapped) return null;
  globalThis.__transovoRealEstateFrontDeskBootstrapped = true;

  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[re-frontdesk] skipping bootstrap — DATABASE_URL missing");
    return null;
  }

  try {
    const workspaceId = process.env.WORKSPACE_ID?.trim();
    if (!workspaceId) {
      console.warn("[re-frontdesk] skipping bootstrap — WORKSPACE_ID missing");
      return null;
    }
    const existing = await loadRealtorProductConfig(workspaceId);
    const productConfig = bootstrapProductConfig(existing);
    const deploy = await deployRealEstateFrontDesk({
      workspaceId,
      productConfig,
      amyMode: productConfig.amyMode || "both",
    });
    const agent = deploy.agent;
    const knowledge = deploy.knowledge;
    const speedToLead = deploy.speedToLead;
    const compiled = deploy.compiled;
    if (!agent || !compiled) {
      throw new Error("Front Desk deploy did not return an agent.");
    }
    await saveRealtorProductConfig(workspaceId, {
      ...productConfig,
      live: true,
      onboardingComplete: true,
      status: "active",
      compiledVersion: compiled.compiledVersion,
      deployedAgentId: agent.agentId,
      deployedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      amyMode: productConfig.amyMode || "both",
      deployedOutboundAgentId: speedToLead?.outboundAgentId || existing.deployedOutboundAgentId,
      frontDeskTemplateAgentId: agent.templateAgentId || existing.frontDeskTemplateAgentId,
      outboundTemplateAgentId:
        speedToLead?.outboundTemplateAgentId || existing.outboundTemplateAgentId,
      followUpAutomationId: speedToLead?.followUpAutomationId || existing.followUpAutomationId,
      frontDeskPublishedVersionId: agent.publishedVersionId || existing.frontDeskPublishedVersionId,
      outboundPublishedVersionId:
        speedToLead?.publishedVersionId || existing.outboundPublishedVersionId,
    });
    console.log(
      JSON.stringify({
        source: "transovo-re-frontdesk-boot",
        event: "real_estate_frontdesk_ready",
        agentId: agent.agentId,
        phoneE164: agent.phoneE164,
        configVersion: agent.configVersion,
        knowledgeBaseId: knowledge?.knowledgeBaseId,
        sourceId: knowledge?.sourceId,
      }),
    );
    const { bootstrapRealtorVerification } = await import("@/lib/realtor/boot-verification");
    await bootstrapRealtorVerification();
    return { agent, knowledge };
  } catch (err) {
    console.error(
      "[re-frontdesk] bootstrap failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export type DeployRealEstateFrontDeskResult = BootstrapRealEstateFrontDeskResult & {
  speedToLead?: Awaited<ReturnType<typeof deployRealtorSpeedToLead>>;
  compiled?: ReturnType<typeof compileRealtorAgents>;
};

/** Full deploy — callable from onboarding Go Live API. */
export async function deployRealEstateFrontDesk(input?: {
  workspaceId?: string;
  phoneE164?: string;
  agentName?: string;
  amyMode?: import("@/lib/realtor/types").RealtorAmyMode;
  useRecommendedFollowUp?: boolean;
  productConfig?: import("@/lib/realtor/types").RealtorProductConfig;
}): Promise<DeployRealEstateFrontDeskResult> {
  const { requireExplicitWorkspaceId } = await import("@/lib/workspace/require-explicit-workspace-id");
  const workspaceId = requireExplicitWorkspaceId(input?.workspaceId, {
    label: "deployRealEstateFrontDesk",
  });
  const existing = input?.productConfig || (await loadRealtorProductConfig(workspaceId));
  const productConfig = {
    ...existing,
    amyMode: input?.amyMode || existing.amyMode,
    speedToLead: {
      ...existing.speedToLead,
      useRecommendedFollowUp:
        input?.useRecommendedFollowUp ?? existing.speedToLead.useRecommendedFollowUp,
    },
  };
  const compiled = compileRealtorAgents(productConfig, { status: "active" });
  const prisma = getPrisma();
  const phoneE164 =
    input?.phoneE164?.trim() ||
    productConfig.phone.inboundNumberE164?.trim() ||
    (
      await prisma.phoneNumber.findFirst({
        where: { workspaceId },
        orderBy: { e164: "asc" },
        select: { e164: true },
      })
    )?.e164;
  if (!phoneE164) {
    throw new Error(
      "Inbound phone number (E.164) is required — select a number on the Front Desk Phone tab before publishing.",
    );
  }

  let agent: Awaited<ReturnType<typeof ensureRealEstateFrontDeskAgent>> | undefined;
  let knowledge: Awaited<ReturnType<typeof seedRealEstateFrontDeskKnowledge>> | undefined;

  if (productConfig.amyMode !== "speed_to_lead") {
    agent = await ensureRealEstateFrontDeskAgent({
      workspaceId,
      phoneE164,
      agentName:
        input?.agentName ||
        (productConfig.business.teamName
          ? `${productConfig.business.teamName} Front Desk`
          : compiled.frontDesk?.identity.agentName),
      assignPhone: true,
      productConfig,
      publish: false,
    });
    knowledge = await seedRealEstateFrontDeskKnowledge({
      workspaceId,
      agentId: agent.agentId,
      businessName: compiled.frontDesk?.identity.companyName,
      businessHours: productConfig.business.businessHours,
      serviceAreas: compiled.frontDesk?.business.serviceAreas,
    });
    const agentRow = await prisma.voiceAgent.findFirst({
      where: { id: agent.agentId, workspaceId },
      select: { draftConfig: true },
    });
    if (agentRow) {
      const published = await publishVoiceAgentVersion({
        workspaceId,
        agentId: agent.agentId,
        config: parseVoiceAgentConfig(agentRow.draftConfig),
        changeLog: `Published real_estate_front_desk v${compiled.frontDesk?.configVersion}`,
      });
      agent.publishedVersionId = published.versionId;
    }
  }

  const speedToLead = await deployRealtorSpeedToLead({
    workspaceId,
    config: productConfig,
    publish: true,
  });

  return { agent, knowledge, speedToLead, compiled };
}
