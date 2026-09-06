import "server-only";

import type {
  SchedulingGroup,
  TeamBookingPage,
  OrganizationSchedulingPolicy,
} from "@/lib/appointments/scheduling-capabilities";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function listSchedulingGroups(workspaceId: string): Promise<SchedulingGroup[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { schedulingGroups?: SchedulingGroup[] }).schedulingGroups || [];
}

export async function saveSchedulingGroup(workspaceId: string, group: SchedulingGroup) {
  const groups = await listSchedulingGroups(workspaceId);
  const idx = groups.findIndex((g) => g.id === group.id);
  const next = idx >= 0 ? groups.map((g, i) => (i === idx ? group : g)) : [...groups, group];
  await saveAppointmentPlatformConfig(workspaceId, { schedulingGroups: next } as object);
  return group;
}

export async function listTeamBookingPages(workspaceId: string): Promise<TeamBookingPage[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { teamBookingPages?: TeamBookingPage[] }).teamBookingPages || [];
}

export async function saveTeamBookingPage(workspaceId: string, page: TeamBookingPage) {
  const pages = await listTeamBookingPages(workspaceId);
  const idx = pages.findIndex((p) => p.id === page.id);
  const next = idx >= 0 ? pages.map((p, i) => (i === idx ? page : p)) : [...pages, page];
  await saveAppointmentPlatformConfig(workspaceId, { teamBookingPages: next } as object);
  return page;
}

export async function getOrganizationSchedulingPolicy(
  workspaceId: string,
): Promise<OrganizationSchedulingPolicy> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (
    (platform as { organizationPolicy?: OrganizationSchedulingPolicy }).organizationPolicy || {}
  );
}

export async function saveOrganizationSchedulingPolicy(
  workspaceId: string,
  policy: OrganizationSchedulingPolicy,
) {
  await saveAppointmentPlatformConfig(workspaceId, { organizationPolicy: policy } as object);
  return policy;
}

export async function resolveTeamPageBySlug(workspaceId: string, slug: string) {
  const pages = await listTeamBookingPages(workspaceId);
  return pages.find((p) => p.slug === slug && p.active !== false) || null;
}

export async function resolveSchedulingGroupStaffIds(
  workspaceId: string,
  groupId: string,
): Promise<string[]> {
  const groups = await listSchedulingGroups(workspaceId);
  const group = groups.find((g) => g.id === groupId);
  return group?.memberStaffIds || [];
}
