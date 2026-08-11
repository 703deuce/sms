import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import {
  DEFAULT_REALTOR_PRODUCT_CONFIG,
  type RealtorOnboardingStep,
  type RealtorProductConfig,
} from "./types";
import {
  onboardingStepsForConfig,
  onboardingStepsForMode,
  STEP_LABELS,
} from "./wizard-steps";

export { onboardingStepsForConfig, onboardingStepsForMode, STEP_LABELS };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function migrateStep(step: string | undefined): RealtorOnboardingStep {
  if (step === "ai_setup") return "front_desk_capabilities";
  const valid = new Set<string>([
    "intent", "business", "phone", "lead_sources", "calendar",
    "front_desk_capabilities", "buyer_qualification", "seller_qualification",
    "showing_config", "existing_client_config", "agent_to_agent_config",
    "speed_lead_types", "outbound_buyer_qual", "outbound_seller_qual",
    "first_call_timing", "follow_up", "sms_email", "booking", "transfers",
    "knowledge", "voice", "notifications", "review", "test", "go_live",
  ]);
  if (step && valid.has(step)) return step as RealtorOnboardingStep;
  return "intent";
}

export function parseRealtorProductConfig(raw: unknown): RealtorProductConfig {
  const stored = asRecord(raw);
  if (!stored.version) return { ...DEFAULT_REALTOR_PRODUCT_CONFIG };
  const parsed = {
    ...DEFAULT_REALTOR_PRODUCT_CONFIG,
    ...(stored as Partial<RealtorProductConfig>),
    currentStep: migrateStep(String(stored.currentStep || "intent")),
    identity: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.identity,
      ...asRecord(stored.identity),
    },
    voice: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.voice,
      ...asRecord(stored.voice),
    },
    knowledge: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.knowledge,
      ...asRecord(stored.knowledge),
    },
    notifications: {
      ...DEFAULT_REALTOR_PRODUCT_CONFIG.notifications,
      ...asRecord(stored.notifications),
    },
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
  return parsed;
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

export function stepLabel(step: RealtorOnboardingStep): string {
  return STEP_LABELS[step] || step;
}
