import { createServiceClient } from "@/lib/db/client";

export type SecurityIndicators = {
  crossTenantDeniedLastHour: number;
  webhookVerifyFailedLastHour: number;
};

/** Count recent high-signal security audit events for admin ops overview. */
export async function loadSecurityIndicators(): Promise<SecurityIndicators> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [{ count: crossTenantDeniedLastHour }, { count: webhookVerifyFailedLastHour }] =
    await Promise.all([
      supabase
        .from("security_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("action", "cross_tenant_denied")
        .gte("created_at", since),
      supabase
        .from("security_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("action", "webhook.verify_failed")
        .gte("created_at", since),
    ]);

  return {
    crossTenantDeniedLastHour: crossTenantDeniedLastHour ?? 0,
    webhookVerifyFailedLastHour: webhookVerifyFailedLastHour ?? 0,
  };
}
