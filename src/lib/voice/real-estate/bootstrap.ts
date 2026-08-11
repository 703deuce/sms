import { deployRealtorSpeedToLead } from "@/lib/realtor/deploy-speed-to-lead";
import { loadRealtorProductConfig, saveRealtorProductConfig } from "@/lib/realtor/workspace-config";
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
  // Default: deploy when frontdesk realtime test mode is on (production inbound path).
  return process.env.FRONTDESK_REALTIME_TEST?.trim() === "1";
}

export type BootstrapRealEstateFrontDeskResult = {
  agent: Awaited<ReturnType<typeof ensureRealEstateFrontDeskAgent>>;
  knowledge: Awaited<ReturnType<typeof seedRealEstateFrontDeskKnowledge>>;
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
    const agent = await ensureRealEstateFrontDeskAgent();
    const knowledge = await seedRealEstateFrontDeskKnowledge({
      workspaceId: process.env.WORKSPACE_ID?.trim() || "ws_1",
      agentId: agent.agentId,
    });
    const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
    const existing = await loadRealtorProductConfig(workspaceId);
    const mergedConfig = {
      ...existing,
      enabled: true,
      live: true,
      onboardingComplete: true,
      deployedAgentId: agent.agentId,
      deployedAt: new Date().toISOString(),
      amyMode: existing.amyMode || "both",
    };
    const speedToLead = await deployRealtorSpeedToLead({
      workspaceId,
      config: mergedConfig,
    });
    await saveRealtorProductConfig(workspaceId, {
      ...mergedConfig,
      deployedOutboundAgentId: speedToLead.outboundAgentId || existing.deployedOutboundAgentId,
      followUpAutomationId: speedToLead.followUpAutomationId || existing.followUpAutomationId,
    });
    console.log(
      JSON.stringify({
        source: "transovo-re-frontdesk-boot",
        event: "real_estate_frontdesk_ready",
        agentId: agent.agentId,
        phoneE164: agent.phoneE164,
        knowledgeBaseId: knowledge.knowledgeBaseId,
        sourceId: knowledge.sourceId,
      }),
    );
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
};

/** Full deploy — callable from onboarding Go Live API. */
export async function deployRealEstateFrontDesk(input?: {
  workspaceId?: string;
  phoneE164?: string;
  agentName?: string;
  amyMode?: import("@/lib/realtor/types").RealtorAmyMode;
  useRecommendedFollowUp?: boolean;
}): Promise<DeployRealEstateFrontDeskResult> {
  const workspaceId = input?.workspaceId || process.env.WORKSPACE_ID?.trim() || "ws_1";
  const agent = await ensureRealEstateFrontDeskAgent({
    workspaceId,
    phoneE164: input?.phoneE164,
    agentName: input?.agentName,
    assignPhone: true,
  });
  const knowledge = await seedRealEstateFrontDeskKnowledge({
    workspaceId,
    agentId: agent.agentId,
  });
  const existing = await loadRealtorProductConfig(workspaceId);
  const speedToLead = await deployRealtorSpeedToLead({
    workspaceId,
    config: {
      ...existing,
      amyMode: input?.amyMode || existing.amyMode,
      speedToLead: {
        ...existing.speedToLead,
        useRecommendedFollowUp:
          input?.useRecommendedFollowUp ?? existing.speedToLead.useRecommendedFollowUp,
      },
    },
  });
  return { agent, knowledge, speedToLead };
}
