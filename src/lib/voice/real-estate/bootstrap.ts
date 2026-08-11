import { deployRealtorSpeedToLead } from "@/lib/realtor/deploy-speed-to-lead";
import { loadRealtorProductConfig, saveRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "@/lib/realtor/types";
import { compileRealtorAgents } from "@/lib/voice/real-estate/compile";
import { ensureRealEstateFrontDeskAgent } from "./deploy-agent";
import { seedRealEstateFrontDeskKnowledge } from "./deploy-knowledge";

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
    const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
    const existing = await loadRealtorProductConfig(workspaceId);
    const productConfig = bootstrapProductConfig(existing);
    const compiled = compileRealtorAgents(productConfig, { status: "active" });

    const agent = await ensureRealEstateFrontDeskAgent({
      workspaceId,
      productConfig,
      publish: true,
      agentName: compiled.frontDesk?.identity.agentName,
    });
    const knowledge = await seedRealEstateFrontDeskKnowledge({
      workspaceId,
      agentId: agent.agentId,
      businessName: compiled.frontDesk?.identity.companyName,
    });
    const speedToLead = await deployRealtorSpeedToLead({
      workspaceId,
      config: productConfig,
      publish: true,
    });
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
      deployedOutboundAgentId: speedToLead.outboundAgentId || existing.deployedOutboundAgentId,
      frontDeskTemplateAgentId: agent.templateAgentId || existing.frontDeskTemplateAgentId,
      outboundTemplateAgentId: speedToLead.outboundTemplateAgentId || existing.outboundTemplateAgentId,
      followUpAutomationId: speedToLead.followUpAutomationId || existing.followUpAutomationId,
      frontDeskPublishedVersionId: agent.publishedVersionId || existing.frontDeskPublishedVersionId,
      outboundPublishedVersionId:
        speedToLead.publishedVersionId || existing.outboundPublishedVersionId,
    });
    console.log(
      JSON.stringify({
        source: "transovo-re-frontdesk-boot",
        event: "real_estate_frontdesk_ready",
        agentId: agent.agentId,
        phoneE164: agent.phoneE164,
        configVersion: agent.configVersion,
        knowledgeBaseId: knowledge.knowledgeBaseId,
        sourceId: knowledge.sourceId,
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
  const workspaceId = input?.workspaceId || process.env.WORKSPACE_ID?.trim() || "ws_1";
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

  let agent: Awaited<ReturnType<typeof ensureRealEstateFrontDeskAgent>> | undefined;
  let knowledge: Awaited<ReturnType<typeof seedRealEstateFrontDeskKnowledge>> | undefined;

  if (productConfig.amyMode !== "speed_to_lead") {
    agent = await ensureRealEstateFrontDeskAgent({
      workspaceId,
      phoneE164: input?.phoneE164,
      agentName:
        input?.agentName ||
        (productConfig.business.teamName
          ? `${productConfig.business.teamName} Front Desk`
          : compiled.frontDesk?.identity.agentName),
      assignPhone: true,
      productConfig,
      publish: true,
    });
    knowledge = await seedRealEstateFrontDeskKnowledge({
      workspaceId,
      agentId: agent.agentId,
      businessName: compiled.frontDesk?.identity.companyName,
    });
  }

  const speedToLead = await deployRealtorSpeedToLead({
    workspaceId,
    config: productConfig,
    publish: true,
  });

  return { agent, knowledge, speedToLead, compiled };
}
