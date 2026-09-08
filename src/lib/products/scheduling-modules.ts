import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export type SchedulingModuleFlags = {
  workflows: boolean;
  meetings: boolean;
  payments: boolean;
  analytics: boolean;
  integrations: boolean;
  classes: boolean;
  commerce: boolean;
  globalSearch: boolean;
};

const DEFAULT_MODULES: SchedulingModuleFlags = {
  workflows: false,
  meetings: false,
  payments: true,
  analytics: true,
  integrations: true,
  classes: false,
  commerce: true,
  globalSearch: true,
};

export async function loadSchedulingModuleFlags(workspaceId: string): Promise<SchedulingModuleFlags> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const stored = (platform as { schedulingModules?: Partial<SchedulingModuleFlags> }).schedulingModules;
  return { ...DEFAULT_MODULES, ...stored };
}

export function defaultSchedulingModuleFlags(): SchedulingModuleFlags {
  return { ...DEFAULT_MODULES };
}
