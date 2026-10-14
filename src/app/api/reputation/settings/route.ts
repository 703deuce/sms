import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";

const DEFAULT_TIMEZONE = "America/New_York";

const nullableText = (max = 255) =>
  z.union([z.string().max(max), z.null()]).optional();

const nullableTime = z
  .union([
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM time"),
    z.literal(""),
    z.null(),
  ])
  .optional();

const putSchema = z.object({
  businessId: z.string().min(1),
  placeId: nullableText(255),
  timezone: z.string().trim().min(1).max(100).optional(),
  quietHoursStart: nullableTime,
  quietHoursEnd: nullableTime,
  defaultSenderName: nullableText(200),
  defaultSenderEmail: nullableText(320),
  defaultSenderPhone: nullableText(80),
  smsComplianceStatus: z
    .enum(["unknown", "not_started", "pending", "approved", "rejected", "disabled"])
    .optional(),
  emailSenderName: nullableText(200),
  emailFromAddress: nullableText(320),
  reviewDetectionMatchDays: z.coerce.number().int().min(1).max(365).optional(),
  reviewDetectionNameFuzzy: z.boolean().optional(),
  dataRetentionDays: z.coerce.number().int().min(30).max(3650).optional(),
});

type BusinessSettingsRow = {
  id: string;
  name: string;
  place_id: string | null;
  timezone: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  default_sender_name: string | null;
  default_sender_email: string | null;
  default_sender_phone: string | null;
  sms_compliance_status: string | null;
  email_sender_name: string | null;
  email_from_address: string | null;
  review_detection_match_days: number | null;
  review_detection_name_fuzzy: boolean | null;
  data_retention_days: number | null;
};

type ReviewLinkRow = {
  id: string;
  review_url: string | null;
  short_url: string | null;
  place_id: string | null;
};

function nullIfBlank(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function timeOrNull(value: string | null | undefined): string | null {
  const text = nullIfBlank(value);
  if (!text) return null;
  return text.length === 5 ? `${text}:00` : text;
}

function mapSettings(row: BusinessSettingsRow, link: ReviewLinkRow | null) {
  return {
    businessId: row.id,
    businessName: row.name,
    placeId: row.place_id ?? "",
    reviewLink: link?.review_url ?? null,
    shortReviewLink: link?.short_url ?? null,
    reviewLinkPlaceId: link?.place_id ?? null,
    timezone: row.timezone ?? DEFAULT_TIMEZONE,
    quietHoursStart: row.quiet_hours_start ?? "",
    quietHoursEnd: row.quiet_hours_end ?? "",
    defaultSenderName: row.default_sender_name ?? "",
    defaultSenderEmail: row.default_sender_email ?? "",
    defaultSenderPhone: row.default_sender_phone ?? "",
    smsComplianceStatus: row.sms_compliance_status ?? "unknown",
    emailSenderName: row.email_sender_name ?? "",
    emailFromAddress: row.email_from_address ?? "",
    reviewDetectionMatchDays: row.review_detection_match_days ?? 14,
    reviewDetectionNameFuzzy: row.review_detection_name_fuzzy ?? true,
    dataRetentionDays: row.data_retention_days ?? 730,
  };
}

const FULL_SETTINGS_SELECT =
  "id, name, place_id, timezone, quiet_hours_start, quiet_hours_end, default_sender_name, default_sender_email, default_sender_phone, sms_compliance_status, email_sender_name, email_from_address, review_detection_match_days, review_detection_name_fuzzy, data_retention_days";

const LEAN_SETTINGS_SELECT = "id, name, place_id";

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist|Could not find the '.+' column/i.test(message);
}

async function loadSettings(businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  let business: BusinessSettingsRow | null = null;

  const full = await supabase
    .from("businesses")
    .select(FULL_SETTINGS_SELECT)
    .eq("id", businessId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (full.error && isMissingColumnError(full.error.message)) {
    // Migration 078 not applied yet — still serve core settings with defaults.
    const lean = await supabase
      .from("businesses")
      .select(LEAN_SETTINGS_SELECT)
      .eq("id", businessId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lean.error) throw new Error(lean.error.message);
    if (!lean.data) throw new Error("Business not found");
    business = {
      id: lean.data.id,
      name: lean.data.name,
      place_id: lean.data.place_id,
      timezone: DEFAULT_TIMEZONE,
      quiet_hours_start: null,
      quiet_hours_end: null,
      default_sender_name: null,
      default_sender_email: null,
      default_sender_phone: null,
      sms_compliance_status: "unknown",
      email_sender_name: null,
      email_from_address: null,
      review_detection_match_days: 14,
      review_detection_name_fuzzy: true,
      data_retention_days: 730,
    };
  } else if (full.error) {
    throw new Error(full.error.message);
  } else if (!full.data) {
    throw new Error("Business not found");
  } else {
    business = full.data as BusinessSettingsRow;
  }

  const { data: link, error: linkError } = await supabase
    .from("review_request_links")
    .select("id, review_url, short_url, place_id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();

  if (linkError) throw new Error(linkError.message);

  return mapSettings(business, (link as ReviewLinkRow | null) ?? null);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const settings = await loadSettings(businessId, auth.organizationId);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to load reputation settings");
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const p = parsed.data;
    const auth = await requireBusinessAccess(p.businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    const updates = {
      place_id: nullIfBlank(p.placeId),
      timezone: p.timezone?.trim() || DEFAULT_TIMEZONE,
      quiet_hours_start: timeOrNull(p.quietHoursStart),
      quiet_hours_end: timeOrNull(p.quietHoursEnd),
      default_sender_name: nullIfBlank(p.defaultSenderName),
      default_sender_email: nullIfBlank(p.defaultSenderEmail),
      default_sender_phone: nullIfBlank(p.defaultSenderPhone),
      sms_compliance_status: p.smsComplianceStatus ?? "unknown",
      email_sender_name: nullIfBlank(p.emailSenderName),
      email_from_address: nullIfBlank(p.emailFromAddress),
      review_detection_match_days: p.reviewDetectionMatchDays ?? 14,
      review_detection_name_fuzzy: p.reviewDetectionNameFuzzy ?? true,
      data_retention_days: p.dataRetentionDays ?? 730,
      updated_at: new Date().toISOString(),
    };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", p.businessId)
      .eq("organization_id", auth.organizationId);

    if (error) {
      if (isMissingColumnError(error.message)) {
        // Persist only fields that exist pre-migration 078.
        const leanUpdate = {
          place_id: nullIfBlank(p.placeId),
          updated_at: new Date().toISOString(),
        };
        const lean = await supabase
          .from("businesses")
          .update(leanUpdate)
          .eq("id", p.businessId)
          .eq("organization_id", auth.organizationId);
        if (lean.error) throw new Error(lean.error.message);
      } else {
        throw new Error(error.message);
      }
    }

    const settings = await loadSettings(p.businessId, auth.organizationId);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to save reputation settings");
  }
}
