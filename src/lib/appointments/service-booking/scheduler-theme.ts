import "server-only";

import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { SchedulerThemeConfig } from "./types";

export async function loadSchedulerTheme(workspaceId: string): Promise<SchedulerThemeConfig> {
  const config = await loadAppointmentPlatformConfig(workspaceId);
  const theme = (config as { schedulerTheme?: SchedulerThemeConfig }).schedulerTheme;
  return theme || {};
}

export async function saveSchedulerTheme(workspaceId: string, theme: SchedulerThemeConfig) {
  const config = await loadAppointmentPlatformConfig(workspaceId);
  await saveAppointmentPlatformConfig(workspaceId, {
    ...config,
    schedulerTheme: theme,
  } as typeof config);
  return theme;
}

export function directLinksForWorkspace(
  baseUrl: string,
  workspaceSlug: string,
  input?: { categorySlug?: string; typeId?: string; staffId?: string; locationId?: string },
) {
  const root = `${baseUrl.replace(/\/$/, "")}/book/${workspaceSlug}`;
  return {
    bookingPage: root,
    category: input?.categorySlug ? `${root}?category=${input.categorySlug}` : undefined,
    bookingType: input?.typeId ? `${root}/${input.typeId}` : undefined,
    provider: input?.staffId ? `${root}?staff=${input.staffId}` : undefined,
    location: input?.locationId ? `${root}?location=${input.locationId}` : undefined,
    packages: `${root}/store`,
    memberships: `${root}/memberships`,
  };
}
