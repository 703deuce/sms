import { createServiceClient } from "@/lib/db/client";
import { getPrisma } from "@/lib/db";

export interface BusinessRow {
  id: string;
  organization_id: string;
  name: string;
  website_url: string | null;
  phone: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  cid: string | null;
  primary_category: string | null;
  service_area_mode: string;
  scan_center_lat: number | null;
  scan_center_lng: number | null;
  scan_center_label: string | null;
  timezone?: string | null;
  created_at: string;
  updated_at: string;
}

/** Workspace-scoped business profile for reputation (LSE compatibility layer). */
export async function getBusiness(businessId: string, organizationId: string): Promise<BusinessRow | null> {
  if (businessId !== organizationId) return null;

  try {
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, createdAt: true },
    });
    if (!workspace) return null;

    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("reputation_workspace_profile")
      .select("google_place_id, timezone, review_link_place_id")
      .eq("workspace_id", businessId)
      .maybeSingle();

    const now = new Date().toISOString();
    return {
      id: workspace.id,
      organization_id: workspace.id,
      name: workspace.name,
      website_url: null,
      phone: null,
      address_text: null,
      lat: null,
      lng: null,
      place_id: profile?.google_place_id ?? null,
      cid: null,
      primary_category: null,
      service_area_mode: "single",
      scan_center_lat: null,
      scan_center_lng: null,
      scan_center_label: null,
      timezone: profile?.timezone ?? "America/Los_Angeles",
      created_at: workspace.createdAt?.toISOString?.() ?? now,
      updated_at: now,
    };
  } catch {
    return null;
  }
}
