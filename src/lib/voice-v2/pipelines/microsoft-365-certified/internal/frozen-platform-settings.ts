import { getPrisma } from "@/lib/db";

export type PlatformPlan = {
  id: string;
  name: string;
  price: number;
  messages: number;
  numbers: number;
  status: "Active" | "Draft";
};

export type PlatformFeatureFlag = {
  id: string;
  name: string;
  enabled: boolean;
};

export type PlatformTrialLimits = {
  days: number;
  messages: number;
  numbers: number;
  credits: number;
  requireCard: boolean;
};

export type PlatformMaintenance = {
  enabled: boolean;
  message: string;
  allowedIps: string;
};

export type PlatformSettingsView = {
  plans: PlatformPlan[];
  featureFlags: PlatformFeatureFlag[];
  trial: PlatformTrialLimits;
  maintenance: PlatformMaintenance;
};

const DEFAULT_PLANS: PlatformPlan[] = [
  { id: "plan_starter", name: "Starter", price: 29, messages: 500, numbers: 1, status: "Active" },
  { id: "plan_growth", name: "Growth", price: 79, messages: 2500, numbers: 3, status: "Active" },
  { id: "plan_pro", name: "Pro", price: 149, messages: 10000, numbers: 10, status: "Active" },
  { id: "plan_enterprise", name: "Enterprise", price: 0, messages: 0, numbers: 0, status: "Draft" },
];

const DEFAULT_FEATURE_FLAGS: PlatformFeatureFlag[] = [
  { id: "ff_ai_templates", name: "AI template generator", enabled: true },
  { id: "ff_mms", name: "MMS messaging", enabled: true },
  { id: "ff_automations_v2", name: "Automations v2 builder", enabled: false },
  { id: "ff_hubspot", name: "HubSpot integration", enabled: true },
  { id: "ff_advanced_reports", name: "Advanced reporting", enabled: true },
];

const DEFAULT_TRIAL: PlatformTrialLimits = {
  days: 14,
  messages: 100,
  numbers: 1,
  credits: 25,
  requireCard: false,
};

const DEFAULT_MAINTENANCE: PlatformMaintenance = {
  enabled: false,
  message: "We're performing scheduled maintenance. Expected completion: 30 minutes.",
  allowedIps: "",
};

export function defaultPlatformSettings(): PlatformSettingsView {
  return {
    plans: DEFAULT_PLANS,
    featureFlags: DEFAULT_FEATURE_FLAGS,
    trial: DEFAULT_TRIAL,
    maintenance: DEFAULT_MAINTENANCE,
  };
}

function coerceView(row: {
  plansJson?: unknown;
  flagsJson?: unknown;
} | null): PlatformSettingsView {
  const defaults = defaultPlatformSettings();
  if (!row) return defaults;
  const plans = Array.isArray(row.plansJson) && row.plansJson.length
    ? (row.plansJson as PlatformPlan[])
    : defaults.plans;
  const flags =
    row.flagsJson && typeof row.flagsJson === "object"
      ? (row.flagsJson as Record<string, unknown>)
      : {};
  const featureFlags = Array.isArray(flags.featureFlags)
    ? (flags.featureFlags as PlatformFeatureFlag[])
    : defaults.featureFlags;
  const trial =
    flags.trial && typeof flags.trial === "object"
      ? { ...defaults.trial, ...(flags.trial as Partial<PlatformTrialLimits>) }
      : defaults.trial;
  const maintenance =
    flags.maintenance && typeof flags.maintenance === "object"
      ? { ...defaults.maintenance, ...(flags.maintenance as Partial<PlatformMaintenance>) }
      : defaults.maintenance;
  return { plans, featureFlags, trial, maintenance };
}

export async function loadPlatformSettings(): Promise<PlatformSettingsView> {
  try {
    const row = await getPrisma().platformSettings.findUnique({ where: { id: "default" } });
    return coerceView(row);
  } catch {
    return defaultPlatformSettings();
  }
}

export async function savePlatformSettings(
  view: PlatformSettingsView,
): Promise<PlatformSettingsView> {
  const plansJson = view.plans;
  const flagsJson = {
    featureFlags: view.featureFlags,
    trial: view.trial,
    maintenance: view.maintenance,
  };
  const row = await getPrisma().platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", plansJson, flagsJson },
    update: { plansJson, flagsJson },
  });
  try {
    const { clearPlatformSettingsCache } = await import("./frozen-platform-flags");
    clearPlatformSettingsCache();
  } catch {
    // ignore
  }
  return coerceView(row);
}
