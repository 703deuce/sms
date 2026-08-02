import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import type { IntegrationActionId } from "./actions-registry";
import type { ExternalProviderId } from "./types";

export type ActionRiskLevel = 1 | 2 | 3 | 4;

export type PolicyMode = "disabled" | "approval_required" | "allowed";

export type WorkspaceAiIntegrationPolicy = {
  readExternalData: PolicyMode;
  createNotes: PolicyMode;
  createTasks: PolicyMode;
  manageTags: PolicyMode;
  updateContacts: PolicyMode;
  updateDeals: PolicyMode;
  createTickets: PolicyMode;
  ticketReplies: PolicyMode;
  manageAppointments: PolicyMode;
  orderNotes: PolicyMode;
  sendSms: PolicyMode;
  bulkActions: PolicyMode;
  preapprovedAutomations: PolicyMode;
  maxRecordsPerAction: number;
  maxMessagesPerAction: number;
  allowedProviders: string[];
  allowedRoles: string[];
  dailyActionLimit: number;
  quietHoursOnly: boolean;
};

export const DEFAULT_AI_POLICY: WorkspaceAiIntegrationPolicy = {
  readExternalData: "allowed",
  createNotes: "allowed",
  createTasks: "approval_required",
  manageTags: "approval_required",
  updateContacts: "approval_required",
  updateDeals: "approval_required",
  createTickets: "approval_required",
  ticketReplies: "approval_required",
  manageAppointments: "approval_required",
  orderNotes: "approval_required",
  sendSms: "approval_required",
  bulkActions: "disabled",
  preapprovedAutomations: "allowed",
  maxRecordsPerAction: 25,
  maxMessagesPerAction: 10,
  allowedProviders: [],
  allowedRoles: ["OWNER", "ADMINISTRATOR", "MANAGER"],
  dailyActionLimit: 200,
  quietHoursOnly: false,
};

/** Classify normalized action risk. Level 4 always needs fresh explicit approval. */
export function classifyActionRisk(
  actionId: string,
  opts?: { bulk?: boolean; recordCount?: number; consentChange?: boolean },
): ActionRiskLevel {
  if (opts?.consentChange) return 4;
  if (opts?.bulk || (opts?.recordCount && opts.recordCount > 1)) return 4;
  if (
    /delete|archive|cancel|suppress|unsubscribe|revoke|refund|payment|inventory|bulk/i.test(
      actionId,
    )
  ) {
    return 4;
  }

  const level3 = new Set<string>([
    "contact.upsert",
    "customer.upsert",
    "contact.add_tag",
    "contact.remove_tag",
    "contact.add_to_list",
    "contact.remove_from_list",
    "deal.upsert",
    "deal.change_stage",
    "ticket.create",
    "ticket.update",
    "ticket.add_public_reply",
    "order.add_note",
    "send_sms",
  ]);
  if (level3.has(actionId)) return 3;

  const level2 = new Set<string>(["task.create", "note.create", "ticket.add_private_note"]);
  if (level2.has(actionId)) return 2;

  if (/search|summarize|retrieve|list|read|get_/i.test(actionId)) return 1;
  return 3;
}

export function policyKeyForAction(actionId: string): keyof WorkspaceAiIntegrationPolicy | null {
  if (actionId.startsWith("note.")) return "createNotes";
  if (actionId.startsWith("task.")) return "createTasks";
  if (actionId.includes("tag")) return "manageTags";
  if (actionId.startsWith("contact.") || actionId.startsWith("customer.")) return "updateContacts";
  if (actionId.startsWith("deal.")) return "updateDeals";
  if (actionId === "ticket.create" || actionId === "ticket.update") return "createTickets";
  if (actionId.includes("ticket") && actionId.includes("reply")) return "ticketReplies";
  if (actionId.includes("ticket") && actionId.includes("note")) return "createNotes";
  if (actionId.includes("appointment")) return "manageAppointments";
  if (actionId.includes("order")) return "orderNotes";
  if (actionId.includes("sms") || actionId === "send_sms") return "sendSms";
  return null;
}

export async function getWorkspaceAiPolicy(
  workspaceId: string,
): Promise<WorkspaceAiIntegrationPolicy> {
  const row = await getPrisma().workspaceAiIntegrationPolicy.findUnique({
    where: { workspaceId },
  });
  if (!row) return { ...DEFAULT_AI_POLICY };
  const stored = (row.policyJson || {}) as Partial<WorkspaceAiIntegrationPolicy>;
  return { ...DEFAULT_AI_POLICY, ...stored };
}

export async function saveWorkspaceAiPolicy(
  workspaceId: string,
  patch: Partial<WorkspaceAiIntegrationPolicy>,
) {
  const current = await getWorkspaceAiPolicy(workspaceId);
  const next = { ...current, ...patch };
  await getPrisma().workspaceAiIntegrationPolicy.upsert({
    where: { workspaceId },
    create: { workspaceId, policyJson: next as object },
    update: { policyJson: next as object },
  });
  return next;
}

export function hashActionPayload(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(stable).digest("hex");
}

export type ActionPreview = {
  actionId: string;
  provider: string;
  connectedAccount: string | null;
  objectType: string;
  recordCount: number;
  sampleRecords: Array<{ id: string; label: string }>;
  fieldsChanged: string[];
  customerFacing: boolean;
  reversible: boolean;
  estimatedMessages: number;
  consentChecked: boolean;
  suppressed: boolean;
  limitations: string[];
  riskLevel: ActionRiskLevel;
  cannotUndoReason?: string;
};

export function buildActionPreview(input: {
  actionId: string;
  provider: string;
  connectedAccount?: string | null;
  params: Record<string, unknown>;
  contactId?: string | null;
  contactLabel?: string | null;
  riskLevel: ActionRiskLevel;
}): ActionPreview {
  const reversible =
    input.actionId === "contact.add_tag" ||
    input.actionId === "deal.change_stage" ||
    input.actionId === "task.create";
  const customerFacing =
    input.actionId.includes("public") ||
    input.actionId === "send_sms" ||
    input.actionId.includes("reply");
  return {
    actionId: input.actionId,
    provider: input.provider,
    connectedAccount: input.connectedAccount || null,
    objectType: input.actionId.split(".")[0] || "object",
    recordCount: 1,
    sampleRecords: input.contactId
      ? [{ id: input.contactId, label: input.contactLabel || input.contactId }]
      : [],
    fieldsChanged: Object.keys(input.params).slice(0, 12),
    customerFacing,
    reversible,
    estimatedMessages: customerFacing ? 1 : 0,
    consentChecked: false,
    suppressed: false,
    limitations: [],
    riskLevel: input.riskLevel,
    cannotUndoReason: reversible
      ? undefined
      : "This cannot be automatically undone.",
  };
}

export async function evaluateActionPolicy(input: {
  workspaceId: string;
  provider: ExternalProviderId | string;
  actionId: IntegrationActionId | string;
  source: "human" | "ai" | "automation" | "api";
  role?: string | null;
  recordCount?: number;
  approvalId?: string | null;
  payloadHash?: string | null;
}): Promise<
  | { allowed: true; riskLevel: ActionRiskLevel; mode: PolicyMode; requiresApproval: boolean }
  | { allowed: false; riskLevel: ActionRiskLevel; code: string; message: string }
> {
  const riskLevel = classifyActionRisk(input.actionId, {
    recordCount: input.recordCount,
  });
  const policy = await getWorkspaceAiPolicy(input.workspaceId);

  if (policy.allowedProviders.length && !policy.allowedProviders.includes(input.provider)) {
    return {
      allowed: false,
      riskLevel,
      code: "PROVIDER_NOT_ALLOWED",
      message: `Provider ${input.provider} is not allowed by workspace AI policy`,
    };
  }

  if (
    input.source === "ai" &&
    input.role &&
    policy.allowedRoles.length &&
    !policy.allowedRoles.includes(input.role)
  ) {
    return {
      allowed: false,
      riskLevel,
      code: "ROLE_REJECTED",
      message: `Role ${input.role} cannot run AI integration actions`,
    };
  }

  if ((input.recordCount || 1) > policy.maxRecordsPerAction) {
    return {
      allowed: false,
      riskLevel,
      code: "BULK_LIMIT",
      message: `Max ${policy.maxRecordsPerAction} records per action`,
    };
  }

  // Level 4 always needs explicit current approval (never from prior chat permission alone).
  // Humans satisfy this via an in-product confirm that sets source=human.
  if (riskLevel === 4 && input.source !== "human") {
    if (!input.approvalId) {
      return {
        allowed: false,
        riskLevel,
        code: "APPROVAL_REQUIRED",
        message: "Level 4 actions always require explicit current approval",
      };
    }
  }

  const key = policyKeyForAction(input.actionId);
  let mode: PolicyMode = "allowed";
  if (input.source === "ai" && key) {
    mode = policy[key] as PolicyMode;
  } else if (input.source === "automation") {
    mode = policy.preapprovedAutomations;
  }

  if (mode === "disabled") {
    return {
      allowed: false,
      riskLevel,
      code: "POLICY_DISABLED",
      message: `Action ${input.actionId} is disabled by workspace policy`,
    };
  }

  const requiresApproval =
    mode === "approval_required" ||
    (riskLevel >= 3 && input.source === "ai") ||
    riskLevel === 4;

  if (requiresApproval && input.source === "ai") {
    if (!input.approvalId || !input.payloadHash) {
      return {
        allowed: false,
        riskLevel,
        code: "APPROVAL_REQUIRED",
        message: "Approval required before execution",
      };
    }
    const approval = await getPrisma().aiActionApproval.findFirst({
      where: { id: input.approvalId, workspaceId: input.workspaceId },
    });
    if (!approval || approval.status !== "approved") {
      return {
        allowed: false,
        riskLevel,
        code: "APPROVAL_INVALID",
        message: "Approval missing or not approved",
      };
    }
    if (approval.expiresAt.getTime() < Date.now()) {
      await getPrisma().aiActionApproval.update({
        where: { id: approval.id },
        data: { status: "expired" },
      });
      return {
        allowed: false,
        riskLevel,
        code: "APPROVAL_EXPIRED",
        message: "Approval expired",
      };
    }
    if (approval.payloadHash !== input.payloadHash) {
      return {
        allowed: false,
        riskLevel,
        code: "APPROVAL_PAYLOAD_MISMATCH",
        message: "Payload changed after approval",
      };
    }
    if (approval.actionId !== input.actionId || approval.provider !== input.provider) {
      return {
        allowed: false,
        riskLevel,
        code: "APPROVAL_MISMATCH",
        message: "Approval does not match action/provider",
      };
    }
  }

  // Daily limit for AI
  if (input.source === "ai") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const count = await getPrisma().integrationActionLog.count({
      where: {
        workspaceId: input.workspaceId,
        source: "ai",
        createdAt: { gte: start },
      },
    });
    if (count >= policy.dailyActionLimit) {
      return {
        allowed: false,
        riskLevel,
        code: "DAILY_LIMIT",
        message: `Daily AI action limit (${policy.dailyActionLimit}) reached`,
      };
    }
  }

  return { allowed: true, riskLevel, mode, requiresApproval };
}
