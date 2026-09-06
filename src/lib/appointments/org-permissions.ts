import "server-only";

import type { GranularRole, EventTypePermission } from "@/lib/appointments/scheduling-capabilities";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";

export type AppointmentPermission = GranularRole["permissions"][number];

export type EventTypeAccessAction = "view" | "book" | "edit";

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

export async function resolveUserRoleId(
  workspaceId: string,
  userId: string,
  email?: string,
): Promise<string> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const assignments = (platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments || {};
  if (assignments[userId]) return assignments[userId];
  if (email) {
    const lower = email.toLowerCase();
    if (assignments[lower]) return assignments[lower];
    if (assignments[email]) return assignments[email];
  }
  return "owner";
}

export async function assertAppointmentPermission(
  workspaceId: string,
  userId: string,
  permission: AppointmentPermission,
  email?: string,
): Promise<boolean> {
  const roleId = await resolveUserRoleId(workspaceId, userId, email);
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
  permission: AppointmentPermission,
  email?: string,
): Promise<void> {
  const allowed = await assertAppointmentPermission(workspaceId, userId, permission, email);
  if (!allowed) throw new Error("Insufficient permissions");
}

export function canAccessEventType(
  typeConfig: AppointmentTypeConfig,
  input: {
    roleId: string;
    userId: string;
    email?: string;
    teamId?: string;
  },
  action: EventTypeAccessAction,
): boolean {
  if (input.roleId === "owner") return true;
  const perms = typeConfig.permissions;
  if (!perms?.length) return true;

  const matches = perms.filter((p) => permissionRuleMatches(p, input, typeConfig));
  if (!matches.length) return false;

  if (action === "view") return matches.some((p) => p.canView !== false);
  if (action === "book") return matches.some((p) => p.canBook !== false);
  return matches.some((p) => p.canEdit !== false);
}

function permissionRuleMatches(
  rule: EventTypePermission,
  input: { roleId: string; userId: string; email?: string; teamId?: string },
  typeConfig: AppointmentTypeConfig,
): boolean {
  if (rule.userId) {
    const target = rule.userId.toLowerCase();
    const email = input.email?.toLowerCase();
    if (rule.userId !== input.userId && target !== email) return false;
  }
  if (rule.teamId) {
    const team = rule.teamId;
    if (team !== input.teamId && team !== typeConfig.ownerTeamId) return false;
  }
  if (rule.role && rule.role !== input.roleId) return false;
  return true;
}

export async function filterEventTypesForUser<T extends { config?: AppointmentTypeConfig }>(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  types: T[],
  action: EventTypeAccessAction = "view",
): Promise<T[]> {
  const roleId = await resolveUserRoleId(workspaceId, userId, email);
  return types.filter((t) =>
    canAccessEventType(t.config || {}, { roleId, userId, email, teamId: t.config?.ownerTeamId }, action),
  );
}

export async function assertEventTypeAccess(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  typeConfig: AppointmentTypeConfig,
  action: EventTypeAccessAction,
): Promise<void> {
  const roleId = await resolveUserRoleId(workspaceId, userId, email);
  if (!canAccessEventType(typeConfig, { roleId, userId, email, teamId: typeConfig.ownerTeamId }, action)) {
    throw new Error("Insufficient permissions for this appointment type");
  }
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
