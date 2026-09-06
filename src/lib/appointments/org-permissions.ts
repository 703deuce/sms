import "server-only";

import type { GranularRole } from "@/lib/appointments/scheduling-capabilities";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";

export const DEFAULT_ROLES: GranularRole[] = [
  {
    id: "owner",
    name: "Owner",
    permissions: [
      "appointments.read",
      "appointments.write",
      "appointments.book",
      "appointments.types.manage",
      "appointments.workflows.manage",
      "appointments.settings.manage",
      "appointments.analytics.read",
      "calendar.connect",
      "team.manage",
    ],
  },
  {
    id: "scheduler",
    name: "Scheduler",
    permissions: [
      "appointments.read",
      "appointments.write",
      "appointments.book",
      "appointments.types.manage",
      "calendar.connect",
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    permissions: ["appointments.read", "appointments.analytics.read"],
  },
];

export async function listGranularRoles(workspaceId: string): Promise<GranularRole[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { granularRoles?: GranularRole[] }).granularRoles || DEFAULT_ROLES;
}

export function roleHasPermission(
  role: GranularRole,
  permission: GranularRole["permissions"][number],
): boolean {
  return role.permissions.includes(permission);
}

export async function assertAppointmentPermission(
  workspaceId: string,
  userId: string,
  permission: GranularRole["permissions"][number],
): Promise<boolean> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const assignments = (platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments || {};
  const roleId = assignments[userId] || "owner";
  const roles = await listGranularRoles(workspaceId);
  const role = roles.find((r) => r.id === roleId) || DEFAULT_ROLES[0];
  return roleHasPermission(role, permission);
}

export async function configureSamlSso(workspaceId: string, input: {
  enabled: boolean;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
}) {
  await saveAppointmentPlatformConfig(workspaceId, { samlSso: input } as object);
  return input;
}

export async function configureScimProvisioning(workspaceId: string, input: {
  enabled: boolean;
  bearerToken?: string;
  defaultRoleId?: string;
}) {
  await saveAppointmentPlatformConfig(workspaceId, { scimProvisioning: input } as object);
  return input;
}

export function isManagedEventType(
  typeConfig: { managed?: boolean },
  orgPolicy: { managedEventTypesOnly?: boolean },
): boolean {
  if (!orgPolicy.managedEventTypesOnly) return true;
  return typeConfig.managed === true;
}

export function isManagedAutomation(
  workflow: { sourceType?: string; templateId?: string | null },
  orgPolicy: { managedAutomationsOnly?: boolean },
): boolean {
  if (!orgPolicy.managedAutomationsOnly) return true;
  return workflow.sourceType === "template" || Boolean(workflow.templateId);
}

export async function getOrganizationPolicy(workspaceId: string) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (
    (platform as { organizationPolicy?: { managedEventTypesOnly?: boolean; managedAutomationsOnly?: boolean } })
      .organizationPolicy || {}
  );
}

export async function requireAppointmentPermission(
  workspaceId: string,
  userId: string,
  permission: GranularRole["permissions"][number],
): Promise<void> {
  const allowed = await assertAppointmentPermission(workspaceId, userId, permission);
  if (!allowed) throw new Error("Insufficient permissions");
}

export async function saveUserRoleAssignments(
  workspaceId: string,
  assignments: Record<string, string>,
) {
  await saveAppointmentPlatformConfig(workspaceId, { userRoleAssignments: assignments } as object);
  return assignments;
}

export async function listUserRoleAssignments(workspaceId: string): Promise<Record<string, string>> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments || {};
}

export function filterTypesForTeamPage<T extends { id: string; config?: { ownerTeamId?: string } }>(
  types: T[],
  teamPage: { appointmentTypeIds: string[]; schedulingGroupId?: string },
  groups: Array<{ id: string; memberTypeIds?: string[] }>,
): T[] {
  const byId = types.filter((t) => teamPage.appointmentTypeIds.includes(t.id));
  if (!teamPage.schedulingGroupId) return byId;
  const group = groups.find((g) => g.id === teamPage.schedulingGroupId);
  if (!group?.memberTypeIds?.length) {
    return byId.filter((t) => !t.config?.ownerTeamId || t.config.ownerTeamId === teamPage.schedulingGroupId);
  }
  const allowed = new Set(group.memberTypeIds);
  return byId.filter((t) => allowed.has(t.id));
}
