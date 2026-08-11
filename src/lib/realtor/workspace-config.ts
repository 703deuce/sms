import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import {
  DEFAULT_REALTOR_PRODUCT_CONFIG,
  type RealtorOnboardingStep,
  type RealtorProductConfig,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseRealtorProductConfig(raw: unknown): RealtorProductConfig {
  const stored = asRecord(raw);
  if (!stored.version) return { ...DEFAULT_REALTOR_PRODUCT_CONFIG };
  return {
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    ...(stored as Partial<RealtorProductConfig>),
    business: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.business, ...asRecord(stored.business) },
    phone: { ...DEFAULT_REALTOR_PRODUCT_CONFIG.phone, ...asRecord(stored.phone) },
    frontDesk: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.frontDesk,
      ...(stored.frontDesk as RealtorProductConfig["frontDesk"]),
    },
    speedToLead: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.speedToLead,
      ...(stored.speedToLead as RealtorProductConfig["speedToLead"]),
    },
  };
}

export async function loadRealtorProductConfig(
  workspaceId: string,
): Promise<RealtorProductConfig> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root = asRecord(workspace?.customFieldsConfig);
  return parseRealtorProductConfig(root.realtorProduct);
}

export async function saveRealtorProductConfig(
  workspaceId: string,
  config: RealtorProductConfig,
): Promise<RealtorProductConfig> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root = asRecord(workspace?.customFieldsConfig);
  const next = { ...root, realtorProduct: config };
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customFieldsConfig: next as object },
  });
  return config;
}

export async function isRealtorWorkspace(workspaceId: string): Promise<boolean> {
  const config = await loadRealtorProductConfig(workspaceId);
  if (config.enabled || config.onboardingComplete || config.live) return true;
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { draftConfig: true },
  });
  return agents.some((row: (typeof agents)[number]) =>
    isRealEstateFrontDeskAgent(
      parseVoiceAgentConfig(row.draftConfig).advanced as Record<string, unknown>,
    ),
  );
}

export function onboardingStepsForMode(
  amyMode: RealtorProductConfig["amyMode"],
): RealtorOnboardingStep[] {
  const base: RealtorOnboardingStep[] = ["intent", "business", "phone"];
  if (amyMode === "speed_to_lead" || amyMode === "both") {
    base.push("lead_sources");
  }
  base.push("calendar", "ai_setup");
  if (amyMode === "speed_to_lead" || amyMode === "both") {
    base.push("follow_up");
  }
  base.push("test", "go_live");
  return base;
}

export function stepLabel(step: RealtorOnboardingStep): string {
  const labels: Record<RealtorOnboardingStep, string> = {
    intent: "What Amy does",
    business: "Business",
    phone: "Phone",
    lead_sources: "Lead Sources",
    calendar: "Calendar",
    ai_setup: "Configure Amy",
    follow_up: "Follow-Up",
    test: "Test Amy",
    go_live: "Go Live",
  };
  return labels[step];
}
