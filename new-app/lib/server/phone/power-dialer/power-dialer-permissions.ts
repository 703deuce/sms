import { getMembershipForUser, isPowerDialerAdminRole } from "./campaign-access";
import { auditComplianceDecision } from "./compliance-gates";

export type PowerDialerScope =
  | "dial"
  | "analytics_read"
  | "analytics_export"
  | "recordings_listen"
  | "settings_write"
  | "team_manage"
  | "reports_schedule"
  | "supervisor_coach";

const REP_SCOPES: PowerDialerScope[] = ["dial", "analytics_read", "recordings_listen"];
const MANAGER_SCOPES: PowerDialerScope[] = [
  ...REP_SCOPES,
  "analytics_export",
  "reports_schedule",
  "supervisor_coach",
];
const ADMIN_SCOPES: PowerDialerScope[] = [
  ...MANAGER_SCOPES,
  "settings_write",
  "team_manage",
];

export function scopesForMembershipRole(role: string): PowerDialerScope[] {
  if (role === "OWNER" || role === "ADMINISTRATOR") return ADMIN_SCOPES;
  if (role === "MANAGER") return MANAGER_SCOPES;
  if (isPowerDialerAdminRole(role)) return ADMIN_SCOPES;
  return REP_SCOPES;
}

export async function requirePowerDialerScope(
  workspaceId: string,
  userId: string,
  scope: PowerDialerScope,
): Promise<{ role: string; repUserId: string }> {
  const membership = await getMembershipForUser(workspaceId, userId);
  if (!membership) throw new Error("Not authorized for this workspace");
  const allowed = scopesForMembershipRole(membership.role);
  if (!allowed.includes(scope)) {
    await auditComplianceDecision({
      workspaceId,
      action: "permission_denied",
      actorUserId: userId,
      detail: { scope, role: membership.role },
    });
    throw new Error(`Permission denied: ${scope}`);
  }
  return { role: membership.role, repUserId: userId };
}

/** Reps see only their sessions/attempts unless admin/manager. */
export function analyticsRepFilter(role: string, userId: string): string | null {
  if (isPowerDialerAdminRole(role) || role === "MANAGER") return null;
  return userId;
}

export function canSupervisorCoach(role: string): boolean {
  return scopesForMembershipRole(role).includes("supervisor_coach");
}
