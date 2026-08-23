import { createServiceClient } from "@/lib/db/client";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/context";
import { isDevBypassEnabled } from "@/lib/auth/dev";
import { writeSecurityAuditEvent } from "@/lib/security/audit-log";
import { isAdminMfaRequired } from "@/lib/auth/admin-mfa";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(email: string | null | undefined): Promise<void> {
  if (!isAdminEmail(email)) {
    throw new Error("Admin access required");
  }
}

/**
 * Platform admin gate: email allowlist + MFA (AAL2) in production.
 */
export async function requirePlatformAdmin(): Promise<{
  userId: string;
  email: string | null;
  organizationId: string;
}> {
  const auth = await requireAuth();
  if (!isAdminEmail(auth.email)) {
    throw new Error("Admin access required");
  }

  if (!isDevBypassEnabled() && isAdminMfaRequired()) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data?.currentLevel !== "aal2") {
      await writeSecurityAuditEvent({
        action: "mfa_required",
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        meta: { currentLevel: data?.currentLevel ?? null },
      });
      const err = new Error("MFA required");
      (err as Error & { code?: string }).code = "mfa_required";
      throw err;
    }
  }

  // Keep the admin's own workspace on the highest plan for product testing.
  try {
    const { setOrganizationPlan } = await import("@/lib/plans");
    await setOrganizationPlan(auth.organizationId, "internal");
  } catch {
    /* non-fatal — plan resolution still auto-promotes on read */
  }

  return {
    userId: auth.userId,
    email: auth.email,
    organizationId: auth.organizationId,
  };
}

export async function listOrganizationsForAdmin() {
  const supabase = createServiceClient();
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, plan, status, billing_status, outbound_paused, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const results = [];
  for (const org of orgs ?? []) {
    const { data: ownerMember } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    let ownerEmail: string | null = null;
    if (ownerMember?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", ownerMember.user_id)
        .maybeSingle();
      ownerEmail = profile?.email ?? null;
    }

    results.push({ ...org, ownerEmail });
  }

  return results;
}
