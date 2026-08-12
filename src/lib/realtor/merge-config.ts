import {
  DEFAULT_REALTOR_PRODUCT_CONFIG,
  type RealtorIntentConfig,
  type RealtorOnboardingStep,
  type RealtorProductConfig,
} from "./types";

const FRONT_DESK_INTENT_KEYS = [
  "buyer",
  "seller",
  "showing",
  "existingClient",
  "agentToAgent",
  "general",
] as const;

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

function mergeIntentConfig(
  defaults: RealtorIntentConfig,
  stored?: Partial<RealtorIntentConfig>,
): RealtorIntentConfig {
  if (!stored) return defaults;
  const fieldMap = new Map(
    (stored.fields || defaults.fields).map((f) => [f.fieldId, f]),
  );
  for (const base of defaults.fields) {
    if (!fieldMap.has(base.fieldId)) fieldMap.set(base.fieldId, base);
  }
  return {
    enabled: stored.enabled ?? defaults.enabled,
    qualifiedOutcome: stored.qualifiedOutcome ?? defaults.qualifiedOutcome,
    fields: Array.from(fieldMap.values()),
  };
}

export function mergeFrontDeskConfig(
  defaults: RealtorProductConfig["frontDesk"],
  stored?: Partial<RealtorProductConfig["frontDesk"]>,
): RealtorProductConfig["frontDesk"] {
  const result = { ...defaults };
  for (const key of FRONT_DESK_INTENT_KEYS) {
    result[key] = mergeIntentConfig(
      defaults[key],
      stored?.[key] as Partial<RealtorIntentConfig> | undefined,
    );
  }
  return result;
}

export function mergeRealtorProductConfig(
  current: RealtorProductConfig,
  partial: Partial<RealtorProductConfig>,
): RealtorProductConfig {
  return {
    ...current,
    ...partial,
    identity: { ...current.identity, ...partial.identity },
    voice: { ...current.voice, ...partial.voice },
    knowledge: { ...current.knowledge, ...partial.knowledge },
    notifications: { ...current.notifications, ...partial.notifications },
    instructions: { ...current.instructions, ...partial.instructions },
    business: { ...current.business, ...partial.business },
    phone: { ...current.phone, ...partial.phone },
    frontDesk: partial.frontDesk
      ? mergeFrontDeskConfig(current.frontDesk, partial.frontDesk)
      : current.frontDesk,
    speedToLead: { ...current.speedToLead, ...partial.speedToLead },
  };
}

export function parseMergedRealtorProductConfig(raw: unknown): RealtorProductConfig {
  const stored =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<RealtorProductConfig>)
      : {};
  if (!stored.version) return { ...DEFAULT_REALTOR_PRODUCT_CONFIG };
  const merged = mergeRealtorProductConfig(DEFAULT_REALTOR_PRODUCT_CONFIG, stored);
  return {
    ...merged,
    currentStep: migrateStep(String(stored.currentStep || merged.currentStep || "intent")),
  };
}
