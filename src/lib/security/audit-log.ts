import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export type SecurityAuditAction =
  | "login_failed"
  | "logout_all"
  | "api_key.create"
  | "api_key.revoke"
  | "integration.webhook.create"
  | "integration.webhook.rotate"
  | "integration.webhook.delete"
  | "report.share.create"
  | "report.share.view"
  | "report.share.revoke"
  | "campaign.launch"
  | "campaign.send"
  | "contacts.export"
  | "contacts.import"
  | "admin.plan_change"
  | "admin.outbound_pause"
  | "admin.job_action"
  | "member.role_change"
  | "org.delete_requested"
  | "cross_tenant_denied"
  | "rate_limit"
  | "webhook.verify_failed"
  | "reauth_required"
  | "mfa_required";

export async function writeSecurityAuditEvent(params: {
  action: SecurityAuditAction | string;
  organizationId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("security_audit_events").insert({
      organization_id: params.organizationId ?? null,
      actor_user_id: params.actorUserId ?? null,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      ip: params.ip ?? null,
      user_agent: params.userAgent ? params.userAgent.slice(0, 300) : null,
      meta: params.meta ?? {},
    });
  } catch (err) {
    logger.warn("security_audit_write_failed", {
      action: params.action,
      error: err instanceof Error ? err.message : "failed",
    });
  }
}

export function requestAuditMeta(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}
