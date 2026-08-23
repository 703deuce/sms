import { createServiceClient } from "@/lib/db/client";
import { mergeWhiteLabel } from "@/lib/reporting/metrics";
import type { WhiteLabelConfig } from "@/lib/reporting/types";

type OrgBrandingRow = {
  name?: string | null;
  report_logo_url?: string | null;
  report_accent_color?: string | null;
  report_footer_text?: string | null;
  report_contact_line?: string | null;
  report_hide_platform_branding?: boolean | null;
};

function brandingFromOrg(org: OrgBrandingRow | null | undefined): Partial<WhiteLabelConfig> {
  if (!org) return {};
  return {
    companyName: org.name?.trim() || undefined,
    logoUrl: org.report_logo_url?.trim() || null,
    accentColor: org.report_accent_color?.trim() || null,
    footerText: org.report_footer_text?.trim() || null,
    contactLine: org.report_contact_line?.trim() || null,
    hidePlatformBranding: Boolean(org.report_hide_platform_branding),
  };
}

/** Resolve company name from the business's organization (legacy helper). */
export async function resolveWhiteLabelCompanyName(
  supabase: ReturnType<typeof createServiceClient>,
  business: { id: string; name?: string | null; organization_id?: string | null }
): Promise<string> {
  const wl = await resolveOrgWhiteLabel(supabase, business);
  return wl.companyName;
}

/** Load org report branding and merge with optional per-request overrides. */
export async function resolveOrgWhiteLabel(
  supabase: ReturnType<typeof createServiceClient>,
  business: { id: string; name?: string | null; organization_id?: string | null },
  partial?: Partial<WhiteLabelConfig> | null
): Promise<WhiteLabelConfig> {
  let org: OrgBrandingRow | null = null;
  let orgId = business.organization_id ?? null;

  if (!orgId) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("organization_id, name")
      .eq("id", business.id)
      .maybeSingle();
    orgId = (biz?.organization_id as string | null) ?? null;
    if (!business.name && biz?.name) {
      business = { ...business, name: biz.name as string };
    }
  }

  if (orgId) {
    const { data, error } = await supabase
      .from("organizations")
      .select(
        "name, report_logo_url, report_accent_color, report_footer_text, report_contact_line, report_hide_platform_branding"
      )
      .eq("id", orgId)
      .maybeSingle();
    if (error) {
      // Branding columns may not exist until migration 042 is applied.
      const { data: fallback } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      org = (fallback as OrgBrandingRow | null) ?? null;
    } else {
      org = (data as OrgBrandingRow | null) ?? null;
    }
  }

  const fromOrg = brandingFromOrg(org);
  const companyName =
    partial?.companyName?.trim() ||
    fromOrg.companyName ||
    business.name?.trim() ||
    "Maps Report";

  return mergeWhiteLabel(companyName, {
    ...fromOrg,
    ...partial,
    companyName,
  });
}

export async function loadOrganizationReportBranding(organizationId: string): Promise<{
  companyName: string;
  logoUrl: string | null;
  accentColor: string | null;
  footerText: string | null;
  contactLine: string | null;
  hidePlatformBranding: boolean;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "name, report_logo_url, report_accent_color, report_footer_text, report_contact_line, report_hide_platform_branding"
    )
    .eq("id", organizationId)
    .maybeSingle();
  if (error) {
    const { data: fallback, error: fallbackErr } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    if (fallbackErr) throw new Error(fallbackErr.message);
    return {
      companyName: (fallback as OrgBrandingRow | null)?.name?.trim() || "Maps Report",
      logoUrl: null,
      accentColor: null,
      footerText: null,
      contactLine: null,
      hidePlatformBranding: false,
    };
  }
  const org = (data as OrgBrandingRow | null) ?? null;
  return {
    companyName: org?.name?.trim() || "Maps Report",
    logoUrl: org?.report_logo_url?.trim() || null,
    accentColor: org?.report_accent_color?.trim() || null,
    footerText: org?.report_footer_text?.trim() || null,
    contactLine: org?.report_contact_line?.trim() || null,
    hidePlatformBranding: Boolean(org?.report_hide_platform_branding),
  };
}

export async function updateOrganizationReportBranding(
  organizationId: string,
  patch: {
    logoUrl?: string | null;
    accentColor?: string | null;
    footerText?: string | null;
    contactLine?: string | null;
    hidePlatformBranding?: boolean;
  }
) {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("logoUrl" in patch) {
    const logo = patch.logoUrl?.trim() || null;
    if (
      logo &&
      !/^https?:\/\//i.test(logo) &&
      !logo.startsWith("/") &&
      !/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(logo)
    ) {
      throw new Error(
        "logoUrl must be an http(s) URL, site-relative path, or data:image… base64"
      );
    }
    update.report_logo_url = logo;
  }
  if ("accentColor" in patch) {
    const color = patch.accentColor?.trim() || null;
    if (color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      throw new Error("accentColor must be a hex color like #059669");
    }
    update.report_accent_color = color;
  }
  if ("footerText" in patch) update.report_footer_text = patch.footerText?.trim() || null;
  if ("contactLine" in patch) update.report_contact_line = patch.contactLine?.trim() || null;
  if ("hidePlatformBranding" in patch) {
    update.report_hide_platform_branding = Boolean(patch.hidePlatformBranding);
  }

  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", organizationId)
    .select(
      "name, report_logo_url, report_accent_color, report_footer_text, report_contact_line, report_hide_platform_branding"
    )
    .single();
  if (error || !data) {
    throw new Error(
      error?.message?.includes("report_")
        ? "Report branding columns are missing — apply migration 042_org_report_branding.sql"
        : error?.message ?? "Failed to update branding"
    );
  }
  const org = data as OrgBrandingRow;
  return {
    companyName: org.name?.trim() || "Maps Report",
    logoUrl: org.report_logo_url?.trim() || null,
    accentColor: org.report_accent_color?.trim() || null,
    footerText: org.report_footer_text?.trim() || null,
    contactLine: org.report_contact_line?.trim() || null,
    hidePlatformBranding: Boolean(org.report_hide_platform_branding),
  };
}
