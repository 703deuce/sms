/**
 * CRM RBAC — workspace role gates for connect / configure / sync / diagnostics.
 */

import { getPrisma } from "@/lib/server/db";

export type CrmAction =
  | "view_crm"
  | "connect_crm"
  | "configure_crm"
  | "run_manual_sync"
  | "view_crm_errors"
  | "retry_crm_jobs"
  | "disconnect_crm"
  | "access_crm_diagnostics"
  | "view_connected_data"
  | "use_crm_quick_actions"
  | "create_crm_automation_actions"
  | "create_integration_triggers"
  | "edit_crm_linked_records"
  | "force_sync"
  | "resolve_mapping_conflicts";

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
    "view_connected_data",
    "use_crm_quick_actions",
    "create_crm_automation_actions",
    "create_integration_triggers",
    "edit_crm_linked_records",
    "force_sync",
    "resolve_mapping_conflicts",
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
    "view_connected_data",
    "use_crm_quick_actions",
    "create_crm_automation_actions",
    "create_integration_triggers",
    "edit_crm_linked_records",
    "force_sync",
    "resolve_mapping_conflicts",
  ],
  MANAGER: [
    "view_crm",
    "configure_crm",
    "run_manual_sync",
    "view_crm_errors",
    "retry_crm_jobs",
    "access_crm_diagnostics",
    "view_connected_data",
    "use_crm_quick_actions",
    "create_crm_automation_actions",
    "create_integration_triggers",
    "edit_crm_linked_records",
    "force_sync",
    "resolve_mapping_conflicts",
  ],
  CAMPAIGN_CREATOR: [
    "view_crm",
    "view_crm_errors",
    "view_connected_data",
    "use_crm_quick_actions",
    "create_crm_automation_actions",
    "create_integration_triggers",
  ],
  INBOX_AGENT: [
    "view_crm",
    "view_connected_data",
    "use_crm_quick_actions",
  ],
  ANALYST: [
    "view_crm",
    "view_crm_errors",
    "access_crm_diagnostics",
    "view_connected_data",
  ],
  READ_ONLY: ["view_crm", "view_connected_data"],
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
  const membership = await getPrisma().membership.findFirst({
    where: { userId, workspaceId },
  });
  if (!membership && action === "connect_crm") {
    return "OWNER";
  }
  const role = membership?.role || "READ_ONLY";
  if (!canCrmAction(role, action)) {
    throw new Error(`Forbidden: ${action} not allowed for role ${role}`);
  }
  return role;
}
