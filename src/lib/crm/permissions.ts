/**
 * CRM RBAC — workspace role gates for connect / configure / sync / diagnostics.
 */

import { getPrisma } from "@/lib/db";

export type CrmAction =
  | "view_crm"
  | "connect_crm"
  | "configure_crm"
  | "run_manual_sync"
  | "view_crm_errors"
  | "retry_crm_jobs"
  | "disconnect_crm"
  | "access_crm_diagnostics";

const MATRIX: Record<string, CrmAction[]> = {
  OWNER: [
    "view_crm",
    "connect_crm",
    "configure_crm",
    "run_manual_sync",
    "view_crm_errors",
    "retry_crm_jobs",
    "disconnect_crm",
    "access_crm_diagnostics",
  ],
  ADMINISTRATOR: [
    "view_crm",
    "connect_crm",
    "configure_crm",
    "run_manual_sync",
    "view_crm_errors",
    "retry_crm_jobs",
    "disconnect_crm",
    "access_crm_diagnostics",
  ],
  MANAGER: [
    "view_crm",
    "configure_crm",
    "run_manual_sync",
    "view_crm_errors",
    "retry_crm_jobs",
    "access_crm_diagnostics",
  ],
  CAMPAIGN_CREATOR: ["view_crm", "view_crm_errors"],
  INBOX_AGENT: ["view_crm"],
  ANALYST: ["view_crm", "view_crm_errors", "access_crm_diagnostics"],
  READ_ONLY: ["view_crm"],
};

export async function getMembershipRole(userId: string, workspaceId: string) {
  const m = await getPrisma().membership.findFirst({
    where: { userId, workspaceId },
  });
  return m?.role || "READ_ONLY";
}

export function canCrmAction(role: string, action: CrmAction): boolean {
  const allowed = MATRIX[role] || MATRIX.READ_ONLY;
  return allowed.includes(action);
}

export async function requireCrmPermission(
  userId: string,
  workspaceId: string,
  action: CrmAction,
) {
  const role = await getMembershipRole(userId, workspaceId);
  if (!canCrmAction(role, action)) {
    throw new Error(`Forbidden: ${action} not allowed for role ${role}`);
  }
  return role;
}
