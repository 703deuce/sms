import { loadPlatformSettings, type PlatformSettingsView } from "@/lib/platform-settings";

let cached: { at: number; view: PlatformSettingsView } | null = null;
const TTL_MS = 15_000;

export async function getPlatformSettingsCached(): Promise<PlatformSettingsView> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.view;
  const view = await loadPlatformSettings();
  cached = { at: Date.now(), view };
  return view;
}

export function clearPlatformSettingsCache() {
  cached = null;
}

export async function isFeatureEnabled(flagId: string, fallback = true): Promise<boolean> {
  const view = await getPlatformSettingsCached();
  const flag = view.featureFlags.find((f) => f.id === flagId);
  return flag ? Boolean(flag.enabled) : fallback;
}

export async function getTrialLimits() {
  const view = await getPlatformSettingsCached();
  return view.trial;
}

export async function getMaintenanceState() {
  const view = await getPlatformSettingsCached();
  return view.maintenance;
}
